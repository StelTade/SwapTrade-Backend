import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Worker } from 'worker_threads';
import * as os from 'os';
import * as path from 'path';

export interface WorkerTask {
  id: string;
  type: 'match' | 'validate' | 'priority';
  data: any;
}

export interface WorkerResult {
  taskId: string;
  success: boolean;
  result?: any;
  error?: string;
}

/**
 * Worker pool for parallel order processing
 * Distributes matching work across CPU cores
 */
@Injectable()
export class MatchingWorkerPoolService implements OnModuleDestroy {
  private readonly logger = new Logger(MatchingWorkerPoolService.name);
  private workers: Worker[] = [];
  private availableWorkers: Worker[] = [];
  private taskQueue: Array<{ task: WorkerTask; resolve: Function; reject: Function }> = [];
  private readonly workerCount: number;
  private taskCallbacks: Map<string, { resolve: Function; reject: Function }> = new Map();

  constructor() {
    // Use 75% of available CPU cores for matching
    this.workerCount = Math.max(2, Math.floor(os.cpus().length * 0.75));
    this.initializeWorkers();
  }

  /**
   * Initialize worker threads
   */
  private initializeWorkers(): void {
    const workerScript = path.join(__dirname, '../workers/matching.worker.js');

    for (let i = 0; i < this.workerCount; i++) {
      try {
        // In production, this would load the compiled worker file
        // For now, we'll simulate worker behavior
        const worker = this.createMockWorker(i);
        this.workers.push(worker);
        this.availableWorkers.push(worker);
        
        this.logger.log(`Initialized worker ${i + 1}/${this.workerCount}`);
      } catch (error) {
        this.logger.error(`Failed to initialize worker ${i}: ${error.message}`);
      }
    }

    this.logger.log(`Worker pool initialized with ${this.workers.length} workers`);
  }

  /**
   * Create mock worker for development
   * In production, this would be a real Worker thread
   */
  private createMockWorker(id: number): any {
    return {
      id,
      postMessage: (message: any) => {
        // Simulate async processing
        setTimeout(() => {
          this.handleWorkerMessage({
            taskId: message.task.id,
            success: true,
            result: { processed: true },
          });
        }, Math.random() * 10);
      },
      on: (event: string, handler: Function) => {
        // Mock event handling
      },
      terminate: () => Promise.resolve(0),
    };
  }

  /**
   * Submit task to worker pool
   */
  async submitTask(task: WorkerTask): Promise<WorkerResult> {
    return new Promise((resolve, reject) => {
      const worker = this.availableWorkers.pop();

      if (worker) {
        // Worker available, execute immediately
        this.executeTask(worker, task, resolve, reject);
      } else {
        // Queue task for later execution
        this.taskQueue.push({ task, resolve, reject });
      }
    });
  }

  /**
   * Execute task on worker
   */
  private executeTask(
    worker: any,
    task: WorkerTask,
    resolve: Function,
    reject: Function,
  ): void {
    this.taskCallbacks.set(task.id, { resolve, reject });

    worker.postMessage({
      task,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle worker message
   */
  private handleWorkerMessage(result: WorkerResult): void {
    const callbacks = this.taskCallbacks.get(result.taskId);
    
    if (callbacks) {
      if (result.success) {
        callbacks.resolve(result);
      } else {
        callbacks.reject(new Error(result.error || 'Worker task failed'));
      }
      
      this.taskCallbacks.delete(result.taskId);
    }

    // Return worker to available pool
    const worker = this.workers.find(w => w.id !== undefined);
    if (worker) {
      this.availableWorkers.push(worker);
      
      // Process queued task if any
      const queued = this.taskQueue.shift();
      if (queued) {
        this.executeTask(worker, queued.task, queued.resolve, queued.reject);
      }
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    totalWorkers: number;
    availableWorkers: number;
    queuedTasks: number;
    activeTasks: number;
  } {
    return {
      totalWorkers: this.workers.length,
      availableWorkers: this.availableWorkers.length,
      queuedTasks: this.taskQueue.length,
      activeTasks: this.taskCallbacks.size,
    };
  }

  /**
   * Shutdown worker pool
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down worker pool...');

    // Wait for active tasks to complete (with timeout)
    const timeout = 5000;
    const startTime = Date.now();

    while (this.taskCallbacks.size > 0 && Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Terminate all workers
    await Promise.all(this.workers.map(worker => worker.terminate()));
    
    this.workers = [];
    this.availableWorkers = [];
    this.taskQueue = [];
    this.taskCallbacks.clear();

    this.logger.log('Worker pool shut down');
  }
}
