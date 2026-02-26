// src/config/config-audit.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from './config.service';
import * as fs from 'fs';
import * as path from 'path';

interface ConfigAuditEntry {
  timestamp: string;
  action: 'load' | 'reload' | 'change' | 'validation_error';
  environment: string;
  user?: string;
  changes?: {
    key: string;
    oldValue: any;
    newValue: any;
  }[];
  error?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class ConfigAuditService implements OnModuleInit {
  private readonly logger = new Logger(ConfigAuditService.name);
  private auditLogPath: string;
  private auditEntries: ConfigAuditEntry[] = [];

  constructor(private readonly configService: ConfigService) {
    this.auditLogPath = path.join(process.cwd(), 'logs', 'config-audit.log');
  }

  onModuleInit() {
    // Ensure audit log directory exists
    const logDir = path.dirname(this.auditLogPath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // Load existing audit entries
    this.loadAuditLog();

    // Subscribe to config events
    this.configService.onConfigLoad((config) => {
      this.logAuditEntry({
        action: 'load',
        environment: this.configService.getEnv(),
        metadata: { configSnapshot: this.getConfigSnapshot() },
      });
    });

    this.configService.onConfigReload((config) => {
      this.logAuditEntry({
        action: 'reload',
        environment: this.configService.getEnv(),
        metadata: { configSnapshot: this.getConfigSnapshot() },
      });
    });

    this.configService.onConfigReloadFailed((error) => {
      this.logAuditEntry({
        action: 'validation_error',
        environment: this.configService.getEnv(),
        error,
      });
    });
  }

  /**
   * Log a configuration audit entry
   */
  private logAuditEntry(entry: Omit<ConfigAuditEntry, 'timestamp'>): void {
    const auditEntry: ConfigAuditEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };

    this.auditEntries.push(auditEntry);

    // Keep only last 1000 entries in memory
    if (this.auditEntries.length > 1000) {
      this.auditEntries = this.auditEntries.slice(-1000);
    }

    // Write to file
    this.writeAuditEntry(auditEntry);

    // Log to console for immediate visibility
    this.logger.log(`Config audit: ${entry.action} in ${entry.environment}`, {
      error: entry.error,
      changes: entry.changes?.length,
    });
  }

  /**
   * Write audit entry to file
   */
  private writeAuditEntry(entry: ConfigAuditEntry): void {
    try {
      const logLine = JSON.stringify(entry) + '\n';
      fs.appendFileSync(this.auditLogPath, logLine);
    } catch (error) {
      this.logger.error('Failed to write config audit entry:', error);
    }
  }

  /**
   * Load existing audit log
   */
  private loadAuditLog(): void {
    try {
      if (fs.existsSync(this.auditLogPath)) {
        const content = fs.readFileSync(this.auditLogPath, 'utf-8');
        const lines = content.trim().split('\n');
        this.auditEntries = lines
          .map(line => {
            try {
              return JSON.parse(line);
            } catch {
              return null;
            }
          })
          .filter(entry => entry !== null)
          .slice(-1000); // Keep only last 1000 entries
      }
    } catch (error) {
      this.logger.error('Failed to load config audit log:', error);
    }
  }

  /**
   * Get a sanitized snapshot of current configuration
   */
  private getConfigSnapshot(): Record<string, any> {
    return {
      environment: this.configService.getEnv(),
      app: {
        port: this.configService.app.port,
        nodeEnv: this.configService.app.nodeEnv,
        cors: this.configService.app.cors,
      },
      database: {
        type: this.configService.database.type,
        database: this.configService.database.database,
        host: this.configService.database.host,
        port: this.configService.database.port,
        // Exclude sensitive data
      },
      redis: {
        host: this.configService.redis.host,
        port: this.configService.redis.port,
        // Exclude password
      },
      cache: {
        enabled: this.configService.cache.enabled,
        ttl: this.configService.cache.ttl,
      },
      features: this.configService.features,
    };
  }

  /**
   * Get audit entries with optional filtering
   */
  getAuditEntries(options?: {
    action?: string;
    since?: Date;
    limit?: number;
  }): ConfigAuditEntry[] {
    let entries = [...this.auditEntries];

    if (options?.action) {
      entries = entries.filter(entry => entry.action === options.action);
    }

    if (options?.since) {
      entries = entries.filter(entry => new Date(entry.timestamp) >= options.since!);
    }

    if (options?.limit) {
      entries = entries.slice(-options.limit);
    }

    return entries;
  }

  /**
   * Get audit summary
   */
  getAuditSummary(): {
    totalEntries: number;
    actions: Record<string, number>;
    lastActivity: string | null;
    errors: number;
  } {
    const actions: Record<string, number> = {};
    let errors = 0;

    for (const entry of this.auditEntries) {
      actions[entry.action] = (actions[entry.action] || 0) + 1;
      if (entry.error) {
        errors++;
      }
    }

    const lastActivity = this.auditEntries.length > 0
      ? this.auditEntries[this.auditEntries.length - 1].timestamp
      : null;

    return {
      totalEntries: this.auditEntries.length,
      actions,
      lastActivity,
      errors,
    };
  }

  /**
   * Clear audit log (admin function)
   */
  clearAuditLog(): void {
    this.auditEntries = [];
    try {
      fs.writeFileSync(this.auditLogPath, '');
      this.logAuditEntry({
        action: 'change',
        environment: this.configService.getEnv(),
        metadata: { action: 'audit_log_cleared' },
      });
    } catch (error) {
      this.logger.error('Failed to clear audit log:', error);
    }
  }
}