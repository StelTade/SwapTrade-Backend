import { NotificationEventType } from '../../common/enums/notification-event-type.enum';
import { NotificationChannel } from '../../common/enums/notification-channel.enum';

const emailAndPush = {
  [NotificationChannel.EMAIL]: { enabled: true },
  [NotificationChannel.IN_APP]: { enabled: true },
  [NotificationChannel.PUSH]: { enabled: true },
  [NotificationChannel.SMS]: { enabled: false },
  [NotificationChannel.WEBHOOK]: { enabled: false },
};

const pushOnly = {
  [NotificationChannel.EMAIL]: { enabled: false },
  [NotificationChannel.IN_APP]: { enabled: true },
  [NotificationChannel.PUSH]: { enabled: true },
  [NotificationChannel.SMS]: { enabled: false },
  [NotificationChannel.WEBHOOK]: { enabled: false },
};

const critical = {
  [NotificationChannel.EMAIL]: { enabled: true },
  [NotificationChannel.IN_APP]: { enabled: true },
  [NotificationChannel.PUSH]: { enabled: true },
  [NotificationChannel.SMS]: { enabled: true },
  [NotificationChannel.WEBHOOK]: { enabled: false },
};

export const defaultPreferences = {
  // ── Order events ──
  [NotificationEventType.ORDER_PLACED]: { ...emailAndPush },
  [NotificationEventType.ORDER_FILLED]: { ...emailAndPush },
  [NotificationEventType.ORDER_CANCELLED]: { ...emailAndPush },
  [NotificationEventType.ORDER_PARTIALLY_FILLED]: { ...pushOnly },

  // ── Trade events ──
  [NotificationEventType.TRADE_EXECUTED]: { ...emailAndPush },

  // ── Deposit events ──
  [NotificationEventType.DEPOSIT_RECEIVED]: { ...emailAndPush },
  [NotificationEventType.DEPOSIT_CONFIRMED]: { ...emailAndPush },
  [NotificationEventType.DEPOSIT_FAILED]: { ...emailAndPush },

  // ── Withdrawal events ──
  [NotificationEventType.WITHDRAWAL_COMPLETED]: { ...emailAndPush },
  [NotificationEventType.WITHDRAWAL_CONFIRMED]: { ...emailAndPush },
  [NotificationEventType.WITHDRAWAL_FAILED]: { ...emailAndPush },

  // ── KYC / Compliance events ──
  [NotificationEventType.KYC_STATUS_CHANGE]: { ...emailAndPush },

  // ── Margin / Risk events ──
  [NotificationEventType.LIQUIDATION]: { ...critical },
  [NotificationEventType.MARGIN_CALL]: { ...critical },
  [NotificationEventType.POSITION_LIQUIDATED]: { ...critical },

  // ── Other events ──
  [NotificationEventType.PRICE_ALERT]: { ...pushOnly },
  [NotificationEventType.ACHIEVEMENT_UNLOCKED]: { ...emailAndPush },
  [NotificationEventType.SECURITY_ALERT]: { ...critical },
};
