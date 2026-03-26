export class WaitlistStatsDto {
  /** Total number of waitlist signups */
  totalSignups: number;
  
  /** Number of verified users */
  verifiedUsers: number;
  
  /** Number of pending users */
  pendingUsers: number;
  
  /** Number of invited users */
  invitedUsers: number;
  
  /** Total referral conversions (verified users who were referred) */
  referralConversions: number;
  
  /** Referral conversion rate (conversions / total signups) */
  referralConversionRate: number;
  
  /** Verification rate (verified / total signups) */
  verificationRate: number;
  
  /** Top referrers with their stats */
  topReferrers: ReferrerStatsDto[];
  
  /** Daily signup trends */
  dailyTrends: DailyTrendDto[];
  
  /** Timestamp of stats generation */
  generatedAt: Date;
}

export class ReferrerStatsDto {
  /** Referrer's referral code */
  referralCode: string;
  
  /** Number of successful referrals */
  referralCount: number;
  
  /** Number of verified referrals */
  verifiedReferrals: number;
}

export class DailyTrendDto {
  /** Date in YYYY-MM-DD format */
  date: string;
  
  /** Number of signups on this date */
  signups: number;
  
  /** Number of verifications on this date */
  verifications: number;
  
  /** Number of referral conversions on this date */
  conversions: number;
}

export class WaitlistMetricsDto {
  /** Prometheus-compatible metric name */
  name: string;
  
  /** Metric help text */
  help: string;
  
  /** Metric type (gauge, counter) */
  type: string;
  
  /** Current value */
  value: number;
  
  /** Labels attached to the metric */
  labels: Record<string, string>;
}

export class DateRangeDto {
  startDate: Date;
  endDate: Date;
}
