import {
  SlaTier,
  SlaMetricType,
  SlaViolationSeverity,
  TicketStatus,
  TicketPriority,
  TicketCategory,
  ReconciliationReportStatus,
  ReconciliationReportType,
  DEFAULT_SLA_TARGETS,
  TICKET_SLA_RESPONSE_MINUTES,
  TICKET_SLA_RESOLUTION_MINUTES,
} from '../enums/institutional.enums';

describe('Institutional Enums', () => {
  describe('SlaTier', () => {
    it('should define PLATINUM, GOLD, SILVER tiers', () => {
      expect(SlaTier.PLATINUM).toBe('PLATINUM');
      expect(SlaTier.GOLD).toBe('GOLD');
      expect(SlaTier.SILVER).toBe('SILVER');
    });
  });

  describe('SlaMetricType', () => {
    it('should define all SLA metric types', () => {
      expect(SlaMetricType.API_RESPONSE_TIME).toBe('API_RESPONSE_TIME');
      expect(SlaMetricType.TRADE_EXECUTION_TIME).toBe('TRADE_EXECUTION_TIME');
      expect(SlaMetricType.SYSTEM_UPTIME).toBe('SYSTEM_UPTIME');
      expect(SlaMetricType.SUPPORT_RESPONSE_TIME).toBe('SUPPORT_RESPONSE_TIME');
      expect(SlaMetricType.REPORTING_LATENCY).toBe('REPORTING_LATENCY');
    });
  });

  describe('DEFAULT_SLA_TARGETS', () => {
    it('should have targets for all three tiers', () => {
      expect(DEFAULT_SLA_TARGETS[SlaTier.PLATINUM]).toBeDefined();
      expect(DEFAULT_SLA_TARGETS[SlaTier.GOLD]).toBeDefined();
      expect(DEFAULT_SLA_TARGETS[SlaTier.SILVER]).toBeDefined();
    });

    it('should have targets for all metric types per tier', () => {
      for (const tier of Object.values(SlaTier)) {
        for (const metric of Object.values(SlaMetricType)) {
          expect(DEFAULT_SLA_TARGETS[tier][metric]).toBeDefined();
          expect(DEFAULT_SLA_TARGETS[tier][metric].target).toBeDefined();
          expect(DEFAULT_SLA_TARGETS[tier][metric].unit).toBeDefined();
          expect(DEFAULT_SLA_TARGETS[tier][metric].warning).toBeDefined();
          expect(DEFAULT_SLA_TARGETS[tier][metric].critical).toBeDefined();
        }
      }
    });

    it('should have PLATINUM tier with stricter targets than GOLD', () => {
      const platinumApi = DEFAULT_SLA_TARGETS[SlaTier.PLATINUM][SlaMetricType.API_RESPONSE_TIME];
      const goldApi = DEFAULT_SLA_TARGETS[SlaTier.GOLD][SlaMetricType.API_RESPONSE_TIME];
      expect(platinumApi.target).toBeLessThan(goldApi.target);
    });

    it('should have GOLD tier with stricter targets than SILVER', () => {
      const goldApi = DEFAULT_SLA_TARGETS[SlaTier.GOLD][SlaMetricType.API_RESPONSE_TIME];
      const silverApi = DEFAULT_SLA_TARGETS[SlaTier.SILVER][SlaMetricType.API_RESPONSE_TIME];
      expect(goldApi.target).toBeLessThan(silverApi.target);
    });

    it('should have PLATINUM uptime target at 99.99%', () => {
      expect(DEFAULT_SLA_TARGETS[SlaTier.PLATINUM][SlaMetricType.SYSTEM_UPTIME].target).toBe(99.99);
    });
  });

  describe('TICKET_SLA_RESPONSE_MINUTES', () => {
    it('should define response SLAs for all priorities and tiers', () => {
      for (const priority of Object.values(TicketPriority)) {
        for (const tier of Object.values(SlaTier)) {
          expect(TICKET_SLA_RESPONSE_MINUTES[priority][tier]).toBeDefined();
          expect(TICKET_SLA_RESPONSE_MINUTES[priority][tier]).toBeGreaterThan(0);
        }
      }
    });

    it('should have CRITICAL tickets with fastest response times', () => {
      const criticalPlatinum = TICKET_SLA_RESPONSE_MINUTES[TicketPriority.CRITICAL][SlaTier.PLATINUM];
      const lowPlatinum = TICKET_SLA_RESPONSE_MINUTES[TicketPriority.LOW][SlaTier.PLATINUM];
      expect(criticalPlatinum).toBeLessThan(lowPlatinum);
    });

    it('should have PLATINUM tier with fastest response times', () => {
      const platinum = TICKET_SLA_RESPONSE_MINUTES[TicketPriority.HIGH][SlaTier.PLATINUM];
      const silver = TICKET_SLA_RESPONSE_MINUTES[TicketPriority.HIGH][SlaTier.SILVER];
      expect(platinum).toBeLessThan(silver);
    });
  });

  describe('TICKET_SLA_RESOLUTION_MINUTES', () => {
    it('should define resolution SLAs for all priorities and tiers', () => {
      for (const priority of Object.values(TicketPriority)) {
        for (const tier of Object.values(SlaTier)) {
          expect(TICKET_SLA_RESOLUTION_MINUTES[priority][tier]).toBeDefined();
          expect(TICKET_SLA_RESOLUTION_MINUTES[priority][tier]).toBeGreaterThan(0);
        }
      }
    });

    it('should have resolution times longer than response times', () => {
      for (const priority of Object.values(TicketPriority)) {
        for (const tier of Object.values(SlaTier)) {
          expect(TICKET_SLA_RESOLUTION_MINUTES[priority][tier]).toBeGreaterThan(
            TICKET_SLA_RESPONSE_MINUTES[priority][tier],
          );
        }
      }
    });
  });

  describe('Ticket enums', () => {
    it('should define all ticket statuses', () => {
      expect(Object.values(TicketStatus)).toEqual([
        'OPEN', 'IN_PROGRESS', 'WAITING_ON_CLIENT', 'ESCALATED', 'RESOLVED', 'CLOSED',
      ]);
    });

    it('should define all ticket priorities', () => {
      expect(Object.values(TicketPriority)).toEqual([
        'LOW', 'MEDIUM', 'HIGH', 'CRITICAL',
      ]);
    });

    it('should define all ticket categories', () => {
      expect(Object.values(TicketCategory)).toEqual([
        'GENERAL', 'TRADING', 'TECHNICAL', 'COMPLIANCE', 'BILLING', 'ONBOARDING',
      ]);
    });
  });

  describe('Reconciliation enums', () => {
    it('should define all report statuses', () => {
      expect(Object.values(ReconciliationReportStatus)).toEqual([
        'PENDING', 'GENERATING', 'COMPLETED', 'FAILED',
      ]);
    });

    it('should define all report types', () => {
      expect(Object.values(ReconciliationReportType)).toEqual([
        'DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM',
      ]);
    });
  });
});
