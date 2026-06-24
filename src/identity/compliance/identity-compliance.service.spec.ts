import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ComplianceStatus,
  COMPLIANCE_EVENTS,
  IdentityComplianceService,
} from './identity-compliance.service';

describe('IdentityComplianceService', () => {
  const make = () => {
    const events = { emit: jest.fn() } as unknown as EventEmitter2;
    const service = new IdentityComplianceService(events);
    return { service, events };
  };

  it('returns CLEAR status for unknown user', () => {
    const { service } = make();
    expect(service.getStatus('u1').status).toBe(ComplianceStatus.CLEAR);
  });

  it('raiseFlag transitions to REVIEW_REQUIRED', () => {
    const { service } = make();
    const r = service.raiseFlag('u1', 'suspicious_activity');
    expect(r.status).toBe(ComplianceStatus.REVIEW_REQUIRED);
    expect(r.riskFlags).toContain('suspicious_activity');
  });

  it('raiseFlag emits ComplianceFlagRaised event', () => {
    const { service, events } = make();
    service.raiseFlag('u1', 'aml_hit');
    expect(events.emit).toHaveBeenCalledWith(
      COMPLIANCE_EVENTS.FLAG_RAISED,
      expect.objectContaining({ userId: 'u1', flag: 'aml_hit' }),
    );
  });

  it('3+ flags transition to BLOCKED', () => {
    const { service } = make();
    service.raiseFlag('u1', 'flag1');
    service.raiseFlag('u1', 'flag2');
    const r = service.raiseFlag('u1', 'flag3');
    expect(r.status).toBe(ComplianceStatus.BLOCKED);
  });

  it('restrict adds restriction and sets RESTRICTED when CLEAR', () => {
    const { service } = make();
    const r = service.restrict('u1', 'no_withdrawals');
    expect(r.restrictions).toContain('no_withdrawals');
    expect(r.status).toBe(ComplianceStatus.RESTRICTED);
  });

  it('clearUser resets all flags and status', () => {
    const { service } = make();
    service.raiseFlag('u1', 'flag1');
    const r = service.clearUser('u1');
    expect(r.status).toBe(ComplianceStatus.CLEAR);
    expect(r.riskFlags).toHaveLength(0);
  });

  it('isRestricted returns true for RESTRICTED status', () => {
    const { service } = make();
    service.restrict('u1', 'x');
    expect(service.isRestricted('u1')).toBe(true);
  });

  it('isRestricted returns true for BLOCKED status', () => {
    const { service } = make();
    service.raiseFlag('u1', 'a');
    service.raiseFlag('u1', 'b');
    service.raiseFlag('u1', 'c');
    expect(service.isRestricted('u1')).toBe(true);
  });

  it('deduplicates flags', () => {
    const { service } = make();
    service.raiseFlag('u1', 'dup');
    const r = service.raiseFlag('u1', 'dup');
    expect(r.riskFlags.filter((f) => f === 'dup')).toHaveLength(1);
  });
});
