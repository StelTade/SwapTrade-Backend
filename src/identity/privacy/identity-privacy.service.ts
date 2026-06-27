import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export const PRIVACY_EVENTS = {
  CONSENT_GRANTED: 'privacy.consent_granted',
  CONSENT_REVOKED: 'privacy.consent_revoked',
  DATA_EXPORT_REQUESTED: 'privacy.data_export_requested',
  DATA_DELETION_REQUESTED: 'privacy.data_deletion_requested',
} as const;

export interface ConsentGrantedEvent {
  userId: string;
  purpose: string;
  grantedAt: Date;
}

export interface ConsentRevokedEvent {
  userId: string;
  purpose: string;
  revokedAt: Date;
}

export interface DataExportRequestedEvent {
  userId: string;
  requestedAt: Date;
}

export interface DataDeletionRequestedEvent {
  userId: string;
  requestedAt: Date;
}

export interface ConsentRecord {
  userId: string;
  purposes: Set<string>;
  updatedAt: Date;
}

export type DataRequest = {
  userId: string;
  type: 'export' | 'deletion';
  requestedAt: Date;
  status: 'pending' | 'completed';
};

@Injectable()
export class IdentityPrivacyService {
  private readonly consents = new Map<string, ConsentRecord>();
  private readonly dataRequests: DataRequest[] = [];

  constructor(private readonly events: EventEmitter2) {}

  grantConsent(userId: string, purpose: string): ConsentRecord {
    const existing = this.consents.get(userId);
    const purposes = new Set(existing?.purposes ?? []);
    purposes.add(purpose);
    const record: ConsentRecord = { userId, purposes, updatedAt: new Date() };
    this.consents.set(userId, record);
    this.events.emit(PRIVACY_EVENTS.CONSENT_GRANTED, {
      userId,
      purpose,
      grantedAt: new Date(),
    } satisfies ConsentGrantedEvent);
    return record;
  }

  revokeConsent(userId: string, purpose: string): ConsentRecord {
    const existing = this.consents.get(userId);
    const purposes = new Set(existing?.purposes ?? []);
    purposes.delete(purpose);
    const record: ConsentRecord = { userId, purposes, updatedAt: new Date() };
    this.consents.set(userId, record);
    this.events.emit(PRIVACY_EVENTS.CONSENT_REVOKED, {
      userId,
      purpose,
      revokedAt: new Date(),
    } satisfies ConsentRevokedEvent);
    return record;
  }

  hasConsent(userId: string, purpose: string): boolean {
    return this.consents.get(userId)?.purposes.has(purpose) ?? false;
  }

  requestDataExport(userId: string): DataRequest {
    const req: DataRequest = {
      userId,
      type: 'export',
      requestedAt: new Date(),
      status: 'pending',
    };
    this.dataRequests.push(req);
    this.events.emit(PRIVACY_EVENTS.DATA_EXPORT_REQUESTED, {
      userId,
      requestedAt: req.requestedAt,
    } satisfies DataExportRequestedEvent);
    return req;
  }

  requestDataDeletion(userId: string): DataRequest {
    const req: DataRequest = {
      userId,
      type: 'deletion',
      requestedAt: new Date(),
      status: 'pending',
    };
    this.dataRequests.push(req);
    this.events.emit(PRIVACY_EVENTS.DATA_DELETION_REQUESTED, {
      userId,
      requestedAt: req.requestedAt,
    } satisfies DataDeletionRequestedEvent);
    return req;
  }

  getPendingRequests(userId: string): DataRequest[] {
    return this.dataRequests.filter(
      (r) => r.userId === userId && r.status === 'pending',
    );
  }
}
