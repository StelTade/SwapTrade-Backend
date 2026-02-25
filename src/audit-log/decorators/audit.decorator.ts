import { SetMetadata } from '@nestjs/common';
import {
  AuditEventType,
  AuditSeverity,
} from 'src/common/security/audit-log.entity';

export const AUDIT_META_KEY = 'audit_meta';

export interface AuditMeta {
  eventType: AuditEventType;
  entityType: string;
  severity?: AuditSeverity;
}

export const Audit = (meta: AuditMeta) => SetMetadata(AUDIT_META_KEY, meta);
