import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface StreamConfig {
  name: string;
  throttleMs?: number;
  batchSize?: number;
  maxSubscribers?: number;
}

export interface StreamStats {
  name: string;
  subscribers: number;
  messagesPublished: number;
  messagesPerSecond: number;
  createdAt: Date;
}

@Injectable()
export class StreamManagerService {
  private readonly logger = new Logger(StreamManagerService.name);
  private streams: Map<string, StreamConfig> = new Map();
  private subscribers: Map<string, Set<string>> = new Map(); // streamName -> clientIds
  private messageCounts: Map<string, number> = new Map();
  private lastMessageTime: Map<string, number> = new Map();
  private throttleTimers: Map<string, NodeJS.Timeout> = new Map();
  private messageBuffers: Map<string, any[]> = new Map();

  constructor(private readonly eventEmitter: EventEmitter2) {}

  createStream(config: StreamConfig): void {
    if (this.streams.has(config.name)) {
      throw new Error(`Stream ${config.name} already exists`);
    }

    this.streams.set(config.name, {
      throttleMs: config.throttleMs || 0,
      batchSize: config.batchSize || 1,
      maxSubscribers: config.maxSubscribers || 1000,
      ...config,
    });

    this.subscribers.set(config.name, new Set());
    this.messageCounts.set(config.name, 0);
    this.messageBuffers.set(config.name, []);

    this.logger.log(`Stream created: ${config.name}`);
  }

  destroyStream(streamName: string): void {
    if (!this.streams.has(streamName)) {
      throw new Error(`Stream ${streamName} does not exist`);
    }

    // Clear throttle timer
    const timer = this.throttleTimers.get(streamName);
    if (timer) {
      clearTimeout(timer);
      this.throttleTimers.delete(streamName);
    }

    this.streams.delete(streamName);
    this.subscribers.delete(streamName);
    this.messageCounts.delete(streamName);
    this.messageBuffers.delete(streamName);

    this.logger.log(`Stream destroyed: ${streamName}`);
  }

  subscribeToStream(streamName: string, clientId: string): boolean {
    const stream = this.streams.get(streamName);
    if (!stream) {
      throw new Error(`Stream ${streamName} does not exist`);
    }

    const subs = this.subscribers.get(streamName)!;
    if (subs.size >= (stream.maxSubscribers || 1000)) {
      this.logger.warn(`Stream ${streamName} reached max subscribers`);
      return false;
    }

    subs.add(clientId);
    this.logger.log(`Client ${clientId} subscribed to stream ${streamName}`);
    return true;
  }

  unsubscribeFromStream(streamName: string, clientId: string): void {
    const subs = this.subscribers.get(streamName);
    if (subs) {
      subs.delete(clientId);
    }
  }

  publishToStream(streamName: string, data: any): void {
    const stream = this.streams.get(streamName);
    if (!stream) {
      throw new Error(`Stream ${streamName} does not exist`);
    }

    const subs = this.subscribers.get(streamName);
    if (!subs || subs.size === 0) {
      return;
    }

    // Increment message count
    const count = this.messageCounts.get(streamName) || 0;
    this.messageCounts.set(streamName, count + 1);

    // Handle throttling
    if (stream.throttleMs && stream.throttleMs > 0) {
      this.bufferMessage(streamName, data, stream);
    } else {
      // Publish immediately
      this.emitMessage(streamName, data);
    }
  }

  getStreamStats(streamName?: string): StreamStats | StreamStats[] {
    if (streamName) {
      const stream = this.streams.get(streamName);
      if (!stream) {
        throw new Error(`Stream ${streamName} does not exist`);
      }

      const subs = this.subscribers.get(streamName)!;
      const count = this.messageCounts.get(streamName) || 0;
      const lastTime = this.lastMessageTime.get(streamName) || 0;
      const now = Date.now();
      const mps = lastTime > 0 ? count / ((now - lastTime) / 1000) : 0;

      return {
        name: streamName,
        subscribers: subs.size,
        messagesPublished: count,
        messagesPerSecond: mps,
        createdAt: new Date(),
      };
    }

    const stats: StreamStats[] = [];
    for (const [name, stream] of this.streams.entries()) {
      const subs = this.subscribers.get(name)!;
      const count = this.messageCounts.get(name) || 0;
      stats.push({
        name,
        subscribers: subs.size,
        messagesPublished: count,
        messagesPerSecond: 0,
        createdAt: new Date(),
      });
    }

    return stats;
  }

  getSubscribers(streamName: string): string[] {
    const subs = this.subscribers.get(streamName);
    return subs ? Array.from(subs) : [];
  }

  private bufferMessage(
    streamName: string,
    data: any,
    config: StreamConfig,
  ): void {
    const buffer = this.messageBuffers.get(streamName) || [];
    buffer.push(data);
    this.messageBuffers.set(streamName, buffer);

    // Set up throttle timer if not already set
    if (!this.throttleTimers.has(streamName)) {
      const timer = setTimeout(() => {
        this.flushBuffer(streamName, config);
      }, config.throttleMs);
      this.throttleTimers.set(streamName, timer);
    }

    // Flush if buffer reaches batch size
    if (buffer.length >= (config.batchSize || 1)) {
      this.flushBuffer(streamName, config);
    }
  }

  private flushBuffer(streamName: string, config: StreamConfig): void {
    const buffer = this.messageBuffers.get(streamName) || [];
    if (buffer.length === 0) {
      this.throttleTimers.delete(streamName);
      return;
    }

    const data = config.batchSize === 1 ? buffer[0] : buffer;
    this.emitMessage(streamName, data);

    // Clear buffer and timer
    this.messageBuffers.set(streamName, []);
    this.throttleTimers.delete(streamName);
  }

  private emitMessage(streamName: string, data: any): void {
    this.lastMessageTime.set(streamName, Date.now());

    this.eventEmitter.emit(`websocket.stream.${streamName}`, {
      streamName,
      data,
      timestamp: new Date().toISOString(),
    });

    const subs = this.subscribers.get(streamName);
    if (subs) {
      this.logger.debug(
        `Published to ${subs.size} subscribers on stream ${streamName}`,
      );
    }
  }
}
