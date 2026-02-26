import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AuditService } from '../logging/audit_service';

@Injectable()
export class BalanceHistoryGuard implements CanActivate {
  constructor(private readonly auditService: AuditService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const { user, params } = request;

    // Check if user is authenticated
    if (!user || !user.id) {
      throw new ForbiddenException('Authentication required');
    }

    const requestedUserId = params.userId;
    const currentUserId = user.id.toString();

    // Users can only access their own balance history
    if (requestedUserId !== currentUserId) {
      // Log unauthorized access attempt
      this.auditService.logLoginAttempt(
        currentUserId,
        false,
        request.ip,
        request.get('User-Agent')
      );

      throw new ForbiddenException('Access denied: Cannot view other users\' balance history');
    }

    // Log authorized access
    this.auditService.logLoginAttempt(
      currentUserId,
      true,
      request.ip,
      request.get('User-Agent')
    );

    return true;
  }
}
