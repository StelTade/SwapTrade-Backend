import { SetMetadata, UseInterceptors, applyDecorators } from '@nestjs/common';
import { AuditInterceptor } from '../interceptors/audit.interceptor';

export const AUDIT_ACTION_KEY = 'audit_action';
export const AUDIT_RESOURCE_KEY = 'audit_resource';

export function Audit(action: string, resource: string) {
  return applyDecorators(
    SetMetadata(AUDIT_ACTION_KEY, action),
    SetMetadata(AUDIT_RESOURCE_KEY, resource),
    UseInterceptors(AuditInterceptor),
  );
}