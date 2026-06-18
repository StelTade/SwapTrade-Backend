import { Inject, Injectable } from '@nestjs/common';
import { AuditLogService } from '../audit-log.service';
import {
  AuditEventType,
  AuditSeverity,
} from '../../common/security/audit-log.entity';

export const AUDITABLE_KEY = Symbol('AUDITABLE');

/**
 * @Auditable decorator - Automatically logs method execution
 * Captures method calls with parameters and results for audit trail
 */
export function Auditable(options?: {
  eventType?: AuditEventType;
  entityType?: string;
  severity?: AuditSeverity;
  logParameters?: boolean;
  logResult?: boolean;
}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    // Mark method as auditable
    Reflect.defineMetadata(AUDITABLE_KEY, options || {}, target, propertyKey);

    descriptor.value = async function (...args: any[]) {
      const auditLogService =
        this.auditLogService || (global as any).auditLogService;

      if (!auditLogService) {
        console.warn(
          `@Auditable: AuditLogService not available for ${target.constructor.name}.${propertyKey}`,
        );
        return originalMethod.apply(this, args);
      }

      const startTime = Date.now();
      let result;
      let error;

      try {
        result = await originalMethod.apply(this, args);

        // Log successful execution
        const auditData = {
          userId: this.currentUserId || args[0]?.userId,
          eventType: options?.eventType || AuditEventType.LOGIN,
          severity: options?.severity || AuditSeverity.INFO,
          entityType: options?.entityType || target.constructor.name,
          entityId: this.extractEntityId(args, result),
          beforeState: options?.logParameters
            ? { parameters: this.sanitizeParameters(args) }
            : undefined,
          afterState: options?.logResult
            ? { result: this.sanitizeResult(result) }
            : undefined,
          metadata: {
            method: propertyKey,
            class: target.constructor.name,
            executionTime: Date.now() - startTime,
          },
          requestId: this.requestId,
        };

        await auditLogService.log(auditData);

        return result;
      } catch (err) {
        error = err;

        // Log failed execution
        const auditData = {
          userId: this.currentUserId || args[0]?.userId,
          eventType: options?.eventType || AuditEventType.SUSPICIOUS_ACTIVITY,
          severity: AuditSeverity.WARNING,
          entityType: options?.entityType || target.constructor.name,
          entityId: this.extractEntityId(args, result),
          beforeState: options?.logParameters
            ? { parameters: this.sanitizeParameters(args) }
            : undefined,
          metadata: {
            method: propertyKey,
            class: target.constructor.name,
            executionTime: Date.now() - startTime,
            error: error.message,
          },
          requestId: this.requestId,
        };

        await auditLogService.log(auditData);

        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Helper methods for the decorator
 */
export class AuditableHelper {
  static extractEntityId(args: any[], result?: any): string | undefined {
    // Try to extract ID from common patterns
    for (const arg of args) {
      if (arg && typeof arg === 'object') {
        if (arg.id) return arg.id;
        if (arg.entityId) return arg.entityId;
        if (arg.userId) return arg.userId;
      }
    }

    if (result && typeof result === 'object' && result.id) {
      return result.id;
    }

    return undefined;
  }

  static sanitizeParameters(args: any[]): any[] {
    return args.map((arg) => {
      if (arg && typeof arg === 'object') {
        const sanitized = { ...arg };
        // Remove sensitive fields
        delete sanitized.password;
        delete sanitized.token;
        delete sanitized.secret;
        return sanitized;
      }
      return arg;
    });
  }

  static sanitizeResult(result: any): any {
    if (result && typeof result === 'object') {
      const sanitized = { ...result };
      // Remove sensitive fields from result
      delete sanitized.password;
      delete sanitized.token;
      delete sanitized.secret;
      return sanitized;
    }
    return result;
  }
}
