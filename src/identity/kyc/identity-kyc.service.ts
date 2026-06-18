import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { KycService } from '../../kyc/kyc.service';
import { KycStatus } from '../../kyc/enum/kyc-status.enum';
import type { AuthenticatedOperator } from '../../kyc/kyc.service';

export const KYC_EVENTS = {
  SUBMITTED: 'kyc.submitted',
  APPROVED: 'kyc.approved',
  REJECTED: 'kyc.rejected',
} as const;

export interface KycSubmittedEvent {
  userId: number;
  submittedAt: Date;
}

export interface KycApprovedEvent {
  userId: number;
  reviewedBy: string;
  approvedAt: Date;
}

export interface KycRejectedEvent {
  userId: number;
  reviewedBy: string;
  reason: string;
  rejectedAt: Date;
}

@Injectable()
export class IdentityKycService {
  constructor(
    private readonly kycService: KycService,
    private readonly events: EventEmitter2,
  ) {}

  async submitKyc(userId: number, operator: AuthenticatedOperator): Promise<void> {
    await this.kycService.updateStatus(userId, KycStatus.PENDING, operator);
    this.events.emit(KYC_EVENTS.SUBMITTED, {
      userId,
      submittedAt: new Date(),
    } satisfies KycSubmittedEvent);
  }

  async approveKyc(
    userId: number,
    operator: AuthenticatedOperator,
    notes?: string,
  ): Promise<void> {
    const record = await this.kycService.updateStatus(
      userId,
      KycStatus.APPROVED,
      operator,
      notes,
    );
    this.events.emit(KYC_EVENTS.APPROVED, {
      userId,
      reviewedBy: record.reviewedBy ?? String(operator.id),
      approvedAt: new Date(),
    } satisfies KycApprovedEvent);
  }

  async rejectKyc(
    userId: number,
    operator: AuthenticatedOperator,
    reason: string,
  ): Promise<void> {
    const record = await this.kycService.updateStatus(
      userId,
      KycStatus.REJECTED,
      operator,
      reason,
    );
    this.events.emit(KYC_EVENTS.REJECTED, {
      userId,
      reviewedBy: record.reviewedBy ?? String(operator.id),
      reason,
      rejectedAt: new Date(),
    } satisfies KycRejectedEvent);
  }

  async getKycRecord(userId: number, requester: AuthenticatedOperator) {
    return this.kycService.getRecord(userId, requester);
  }
}