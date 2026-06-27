/**
 * Institutional Portal Enums
 */

/** SLA Tier levels */
export enum SlaTier {
  PLATINUM = 'PLATINUM',
  GOLD = 'GOLD',
  SILVER = 'SILVER',
}

/** SLA Metric Types */
export enum SlaMetricType {
  API_RESPONSE_TIME = 'API_RESPONSE_TIME',
  TRADE_EXECUTION_TIME = 'TRADE_EXECUTION_TIME',
  SYSTEM_UPTIME = 'SYSTEM_UPTIME',
  SUPPORT_RESPONSE_TIME = 'SUPPORT_RESPONSE_TIME',
  REPORTING_LATENCY = 'REPORTING_LATENCY',
}

/** SLA Violation Severity */
export enum SlaViolationSeverity {
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

/** Support Ticket Status */
export enum TicketStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  WAITING_ON_CLIENT = 'WAITING_ON_CLIENT',
  ESCALATED = 'ESCALATED',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

/** Support Ticket Priority */
export enum TicketPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/** Support Ticket Category */
export enum TicketCategory {
  GENERAL = 'GENERAL',
  TRADING = 'TRADING',
  TECHNICAL = 'TECHNICAL',
  COMPLIANCE = 'COMPLIANCE',
  BILLING = 'BILLING',
  ONBOARDING = 'ONBOARDING',
}

/** Reconciliation Report Status */
export enum ReconciliationReportStatus {
  PENDING = 'PENDING',
  GENERATING = 'GENERATING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

/** Reconciliation Report Type */
export enum ReconciliationReportType {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  CUSTOM = 'CUSTOM',
}

/** Default SLA targets per tier */
export const DEFAULT_SLA_TARGETS: Record<
  SlaTier,
  Record<
    SlaMetricType,
    { target: number; unit: string; warning: number; critical: number }
  >
> = {
  [SlaTier.PLATINUM]: {
    [SlaMetricType.API_RESPONSE_TIME]: {
      target: 50,
      unit: 'MILLISECONDS',
      warning: 80,
      critical: 150,
    },
    [SlaMetricType.TRADE_EXECUTION_TIME]: {
      target: 10,
      unit: 'MILLISECONDS',
      warning: 25,
      critical: 50,
    },
    [SlaMetricType.SYSTEM_UPTIME]: {
      target: 99.99,
      unit: 'PERCENT',
      warning: 99.95,
      critical: 99.9,
    },
    [SlaMetricType.SUPPORT_RESPONSE_TIME]: {
      target: 5,
      unit: 'MINUTES',
      warning: 10,
      critical: 15,
    },
    [SlaMetricType.REPORTING_LATENCY]: {
      target: 30,
      unit: 'SECONDS',
      warning: 60,
      critical: 120,
    },
  },
  [SlaTier.GOLD]: {
    [SlaMetricType.API_RESPONSE_TIME]: {
      target: 100,
      unit: 'MILLISECONDS',
      warning: 200,
      critical: 500,
    },
    [SlaMetricType.TRADE_EXECUTION_TIME]: {
      target: 25,
      unit: 'MILLISECONDS',
      warning: 50,
      critical: 100,
    },
    [SlaMetricType.SYSTEM_UPTIME]: {
      target: 99.95,
      unit: 'PERCENT',
      warning: 99.9,
      critical: 99.5,
    },
    [SlaMetricType.SUPPORT_RESPONSE_TIME]: {
      target: 15,
      unit: 'MINUTES',
      warning: 30,
      critical: 60,
    },
    [SlaMetricType.REPORTING_LATENCY]: {
      target: 60,
      unit: 'SECONDS',
      warning: 120,
      critical: 300,
    },
  },
  [SlaTier.SILVER]: {
    [SlaMetricType.API_RESPONSE_TIME]: {
      target: 200,
      unit: 'MILLISECONDS',
      warning: 500,
      critical: 1000,
    },
    [SlaMetricType.TRADE_EXECUTION_TIME]: {
      target: 50,
      unit: 'MILLISECONDS',
      warning: 100,
      critical: 250,
    },
    [SlaMetricType.SYSTEM_UPTIME]: {
      target: 99.9,
      unit: 'PERCENT',
      warning: 99.5,
      critical: 99.0,
    },
    [SlaMetricType.SUPPORT_RESPONSE_TIME]: {
      target: 30,
      unit: 'MINUTES',
      warning: 60,
      critical: 120,
    },
    [SlaMetricType.REPORTING_LATENCY]: {
      target: 120,
      unit: 'SECONDS',
      warning: 300,
      critical: 600,
    },
  },
};

/** SLA response time in minutes per priority (for support tickets) */
export const TICKET_SLA_RESPONSE_MINUTES: Record<
  TicketPriority,
  Record<SlaTier, number>
> = {
  [TicketPriority.CRITICAL]: {
    [SlaTier.PLATINUM]: 5,
    [SlaTier.GOLD]: 15,
    [SlaTier.SILVER]: 30,
  },
  [TicketPriority.HIGH]: {
    [SlaTier.PLATINUM]: 15,
    [SlaTier.GOLD]: 30,
    [SlaTier.SILVER]: 60,
  },
  [TicketPriority.MEDIUM]: {
    [SlaTier.PLATINUM]: 30,
    [SlaTier.GOLD]: 60,
    [SlaTier.SILVER]: 240,
  },
  [TicketPriority.LOW]: {
    [SlaTier.PLATINUM]: 60,
    [SlaTier.GOLD]: 240,
    [SlaTier.SILVER]: 480,
  },
};

/** SLA resolution time in minutes per priority (for support tickets) */
export const TICKET_SLA_RESOLUTION_MINUTES: Record<
  TicketPriority,
  Record<SlaTier, number>
> = {
  [TicketPriority.CRITICAL]: {
    [SlaTier.PLATINUM]: 60,
    [SlaTier.GOLD]: 240,
    [SlaTier.SILVER]: 480,
  },
  [TicketPriority.HIGH]: {
    [SlaTier.PLATINUM]: 240,
    [SlaTier.GOLD]: 480,
    [SlaTier.SILVER]: 1440,
  },
  [TicketPriority.MEDIUM]: {
    [SlaTier.PLATINUM]: 480,
    [SlaTier.GOLD]: 1440,
    [SlaTier.SILVER]: 2880,
  },
  [TicketPriority.LOW]: {
    [SlaTier.PLATINUM]: 1440,
    [SlaTier.GOLD]: 2880,
    [SlaTier.SILVER]: 4320,
  },
};
