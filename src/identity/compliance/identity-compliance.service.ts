import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export enum ComplianceStatus {
  CLEAR = 'CLEAR',
  REVIEW_REQUIRED = 'REVIEW_REQUIRED',
  RESTRICTED = 'RESTRICTED',
  BLOCKED = 'BLOCKED',
}

export interface UserComplianceRecord {
  userId: string;
  status: ComplianceStatus;
  riskFlags: string[];
  restrictions: string[];
  updatedAt: Date;
}

export const COMPLIANCE_EVENTS = {
  FLAG_RAISED: 'compliance.flag_raised',
} as const;

export interface ComplianceFlagRaisedEvent {
  userId: string;
  flag: string;
  newStatus: ComplianceStatus;
  raisedAt: Date;
}

@Injectable()
export class IdentityComplianceService {
  private readonly records = new Map<string, UserComplianceRecord>();

  constructor(private readonly events: EventEmitter2) {}

  getStatus(userId: string): UserComplianceRecord {
    return (
      this.records.get(userId) ?? {
        userId,
        status: ComplianceStatus.CLEAR,
        riskFlags: [],
        restrictions: [],
        updatedAt: new Date(),
      }
    );
  }

  raiseFlag(userId: string, flag: string): UserComplianceRecord {
    const existing = this.getStatus(userId);
    const riskFlags = [...new Set([...existing.riskFlags, flag])];

    const status =
      riskFlags.length >= 3
        ? ComplianceStatus.BLOCKED
        : riskFlags.length >= 1
          ? ComplianceStatus.REVIEW_REQUIRED
          : ComplianceStatus.CLEAR;

    const updated: UserComplianceRecord = {
      ...existing,
      riskFlags,
      status,
      updatedAt: new Date(),
    };

    this.records.set(userId, updated);

    this.events.emit(COMPLIANCE_EVENTS.FLAG_RAISED, {
      userId,
      flag,
      newStatus: status,
      raisedAt: new Date(),
    } satisfies ComplianceFlagRaisedEvent);

    return updated;
  }

  restrict(userId: string, restriction: string): UserComplianceRecord {
    const existing = this.getStatus(userId);
    const restrictions = [...new Set([...existing.restrictions, restriction])];
    const updated: UserComplianceRecord = {
      ...existing,
      restrictions,
      status:
        existing.status === ComplianceStatus.CLEAR
          ? ComplianceStatus.RESTRICTED
          : existing.status,
      updatedAt: new Date(),
    };
    this.records.set(userId, updated);
    return updated;
  }

  clearUser(userId: string): UserComplianceRecord {
    const cleared: UserComplianceRecord = {
      userId,
      status: ComplianceStatus.CLEAR,
      riskFlags: [],
      restrictions: [],
      updatedAt: new Date(),
    };
    this.records.set(userId, cleared);
    return cleared;
  }

  isRestricted(userId: string): boolean {
    const record = this.getStatus(userId);
    return (
      record.status === ComplianceStatus.RESTRICTED ||
      record.status === ComplianceStatus.BLOCKED
    );
  }
}
