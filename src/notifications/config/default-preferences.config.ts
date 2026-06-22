import { NotificationEventType } from '../../common/enums/notification-event-type.enum';
import { NotificationChannel } from '../../common/enums/notification-channel.enum';

export const defaultPreferences = {
  [NotificationEventType.TRADE_EXECUTED]: {
    [NotificationChannel.EMAIL]: { enabled: true },
    [NotificationChannel.PUSH]: { enabled: true },
    [NotificationChannel.SMS]: { enabled: false },
  },
  [NotificationEventType.LIQUIDATION]: {
    [NotificationChannel.EMAIL]: { enabled: true },
    [NotificationChannel.PUSH]: { enabled: true },
    [NotificationChannel.SMS]: { enabled: true }, // Critical alert - SMS enabled by default
  },
  [NotificationEventType.DEPOSIT_RECEIVED]: {
    [NotificationChannel.EMAIL]: { enabled: true },
    [NotificationChannel.PUSH]: { enabled: true },
    [NotificationChannel.SMS]: { enabled: false },
  },
  [NotificationEventType.WITHDRAWAL_COMPLETED]: {
    [NotificationChannel.EMAIL]: { enabled: true },
    [NotificationChannel.PUSH]: { enabled: true },
    [NotificationChannel.SMS]: { enabled: false },
  },
  [NotificationEventType.SECURITY_ALERT]: {
    [NotificationChannel.EMAIL]: { enabled: true },
    [NotificationChannel.PUSH]: { enabled: true },
    [NotificationChannel.SMS]: { enabled: true }, // Critical security alert - SMS enabled
  },
  [NotificationEventType.ORDER_FILLED]: {
    [NotificationChannel.EMAIL]: { enabled: true },
    [NotificationChannel.PUSH]: { enabled: true },
    [NotificationChannel.SMS]: { enabled: false },
  },
  [NotificationEventType.PRICE_ALERT]: {
    [NotificationChannel.EMAIL]: { enabled: false },
    [NotificationChannel.PUSH]: { enabled: true },
    [NotificationChannel.SMS]: { enabled: false },
  },
  [NotificationEventType.ACHIEVEMENT_UNLOCKED]: {
    [NotificationChannel.EMAIL]: { enabled: true },
    [NotificationChannel.PUSH]: { enabled: true },
    [NotificationChannel.SMS]: { enabled: false },
  },
};