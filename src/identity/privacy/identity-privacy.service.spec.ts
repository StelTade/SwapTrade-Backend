import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  IdentityPrivacyService,
  PRIVACY_EVENTS,
} from './identity-privacy.service';

describe('IdentityPrivacyService', () => {
  const make = () => {
    const events = { emit: jest.fn() } as unknown as EventEmitter2;
    const service = new IdentityPrivacyService(events);
    return { service, events };
  };

  it('grantConsent stores consent and emits event', () => {
    const { service, events } = make();
    const r = service.grantConsent('u1', 'marketing');
    expect(r.purposes.has('marketing')).toBe(true);
    expect(events.emit).toHaveBeenCalledWith(
      PRIVACY_EVENTS.CONSENT_GRANTED,
      expect.objectContaining({ userId: 'u1', purpose: 'marketing' }),
    );
  });

  it('revokeConsent removes consent and emits event', () => {
    const { service, events } = make();
    service.grantConsent('u1', 'analytics');
    service.revokeConsent('u1', 'analytics');
    expect(service.hasConsent('u1', 'analytics')).toBe(false);
    expect(events.emit).toHaveBeenCalledWith(
      PRIVACY_EVENTS.CONSENT_REVOKED,
      expect.objectContaining({ userId: 'u1', purpose: 'analytics' }),
    );
  });

  it('hasConsent returns false for unknown user', () => {
    const { service } = make();
    expect(service.hasConsent('nobody', 'x')).toBe(false);
  });

  it('requestDataExport creates pending request and emits event', () => {
    const { service, events } = make();
    const req = service.requestDataExport('u1');
    expect(req.type).toBe('export');
    expect(req.status).toBe('pending');
    expect(events.emit).toHaveBeenCalledWith(
      PRIVACY_EVENTS.DATA_EXPORT_REQUESTED,
      expect.objectContaining({ userId: 'u1' }),
    );
  });

  it('requestDataDeletion creates pending request and emits event', () => {
    const { service, events } = make();
    const req = service.requestDataDeletion('u1');
    expect(req.type).toBe('deletion');
    expect(events.emit).toHaveBeenCalledWith(
      PRIVACY_EVENTS.DATA_DELETION_REQUESTED,
      expect.objectContaining({ userId: 'u1' }),
    );
  });

  it('getPendingRequests returns only pending requests for user', () => {
    const { service } = make();
    service.requestDataExport('u1');
    service.requestDataDeletion('u1');
    service.requestDataExport('u2');
    const pending = service.getPendingRequests('u1');
    expect(pending).toHaveLength(2);
    expect(pending.every((r) => r.userId === 'u1')).toBe(true);
  });

  it('multiple consents accumulate', () => {
    const { service } = make();
    service.grantConsent('u1', 'a');
    const r = service.grantConsent('u1', 'b');
    expect(r.purposes.has('a')).toBe(true);
    expect(r.purposes.has('b')).toBe(true);
  });
});
