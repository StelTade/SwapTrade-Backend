# Notification & Alert System

## Overview

The notification and alert system allows users to configure custom alerts for trading events (price movements, volume thresholds, portfolio changes) and receive notifications through multiple channels: email, SMS, push (FCM), and in-app.

---

## Environment Variables

Add the following to your `.env` file:

```env
# Email (SMTP)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASS=your-smtp-password
SMTP_FROM=noreply@swaptrade.io
APP_URL=http://localhost:3000

# SMS (Twilio)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_FROM_NUMBER=+15551234567

# Push Notifications (Firebase Cloud Messaging)
PUSH_PROVIDER=fcm                            # set to 'fcm' to enable push
FIREBASE_SERVER_KEY=AAAAxxxxxxxx...          # Firebase legacy server key
```

---

## Alert System

### Alert Types

| Type | Trigger condition |
|---|---|
| `PRICE` | Asset spot price crosses a threshold |
| `VOLUME` | Asset 24-hour volume crosses a threshold |
| `PORTFOLIO_CHANGE` | Portfolio total value changes by an amount or percentage |

### Operators

`GT` (>), `LT` (<), `GTE` (>=), `LTE` (<=)

### Alert Channels

`EMAIL`, `SMS`, `IN_APP`, `PUSH`

---

## Alert API Endpoints

### Create Alert

```http
POST /alerts/:userId
Content-Type: application/json

{
  "name": "BTC above $50k",
  "type": "PRICE",
  "asset": "BTCUSDT",
  "operator": "GT",
  "threshold": 50000,
  "channels": ["EMAIL", "IN_APP"],
  "cooldownMinutes": 60
}
```

**Portfolio change alert example:**
```json
{
  "name": "Portfolio drops 5%",
  "type": "PORTFOLIO_CHANGE",
  "changeType": "PERCENTAGE",
  "changeThreshold": 5.0,
  "channels": ["SMS", "IN_APP"],
  "cooldownMinutes": 120
}
```

### List Alerts

```http
GET /alerts/:userId
```

### Get Alert

```http
GET /alerts/:userId/:alertId
```

### Update Alert

```http
PATCH /alerts/:userId/:alertId
Content-Type: application/json

{
  "threshold": 55000,
  "cooldownMinutes": 30
}
```

### Delete Alert

```http
DELETE /alerts/:userId/:alertId
```
Returns `204 No Content`.

### Pause / Resume Alert

```http
POST /alerts/:userId/:alertId/pause
POST /alerts/:userId/:alertId/resume
```

### Alert Trigger History

```http
GET /alerts/:userId/:alertId/history?limit=50&offset=0
```

Returns the list of times this alert fired, with the trigger value and notification ID.

---

## Alert Evaluation

Alerts are evaluated automatically:

- **PRICE / VOLUME alerts**: Evaluated on every market data update received from the Binance/Coinbase WebSocket feeds.
- **PORTFOLIO_CHANGE alerts**: Evaluated when a `user.portfolio.updated` event is emitted (e.g., after a trade executes).

When an alert condition is met and the cooldown has expired, a job is enqueued in the `alerts` Bull queue. The `AlertProcessor` then delivers the notification via the selected channels.

**Cooldown**: After firing, an alert enters `TRIGGERED` status. It won't fire again until `cooldownMinutes` has elapsed. Use `POST /alerts/:userId/:alertId/resume` to manually re-activate it.

**Portfolio baseline**: On first evaluation, the current portfolio value is stored as the `referenceValue`. Subsequent evaluations compare against this baseline. The baseline resets after each trigger.

---

## Notification Preferences API

### Per-channel preferences (granular control)

Get or update which types of notifications are enabled per channel:

```http
GET  /notification/preferences/:userId
PATCH /notification/preferences/:userId

# PATCH body — array of preference objects:
[
  { "type": "ALERT", "channel": "EMAIL", "enabled": true },
  { "type": "ORDER_FILLED", "channel": "SMS", "enabled": false }
]
```

Each preference row also tracks `dailyLimit` and `sentToday` to prevent spam.

### High-level notification settings

Get or update frequency, channels, and notification type toggles:

```http
GET   /notification/settings/:userId
PATCH /notification/settings/:userId

# PATCH body:
{
  "frequency": "INSTANT",           // INSTANT | HOURLY | DAILY
  "channels": ["EMAIL", "IN_APP"],  // default delivery channels
  "tradeNotifications": true,
  "balanceNotifications": true,
  "milestoneNotifications": false
}
```

### Unsubscribe via token

```http
GET /notification/unsubscribe?token=<unsubscribeToken>
```

Disables the preference row associated with the token. Unsubscribe tokens are included automatically in email delivery footers.

---

## Notification Delivery API

### Send a notification (internal/admin use)

```http
POST /notification
Content-Type: application/json

{
  "userId": 1,
  "type": "ORDER_FILLED",
  "message": "Your order for 0.5 BTC has been filled.",
  "subject": "Order Filled",
  "channels": ["EMAIL", "IN_APP"]
}
```

### List user notifications

```http
GET /notification/:userId?limit=20&offset=0&status=SENT
```

`status` filter: `SENT`, `READ`, `FAILED`

### Mark notification as read

```http
POST /notification/:notificationId/read
Content-Type: application/json

{ "userId": 1 }
```

---

## Notification Channels

### Email
- Delivered via SMTP (nodemailer).
- Requires `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`.
- Each email includes an unsubscribe link.
- The `metadata.email` field in the notification must contain the recipient address.

### SMS
- Delivered via Twilio.
- Requires `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`.
- The `metadata.phone` field must contain the E.164 phone number (e.g. `+15551234567`).

### In-App
- The notification record is stored in the database and returned by `GET /notification/:userId`.
- No additional transport needed. Clients can poll this endpoint or listen for WebSocket events.

### Push (FCM)
- Delivered via Firebase Cloud Messaging.
- Requires `PUSH_PROVIDER=fcm` and `FIREBASE_SERVER_KEY`.
- The `metadata.deviceToken` field must contain the FCM registration token.
- If `PUSH_PROVIDER` is not set to `fcm`, push delivery is skipped with a warning log.

---

## Notification Templates

Templates use Handlebars syntax and are stored in the `notification_templates` table.

| Field | Description |
|---|---|
| `key` | Unique template key (e.g. `order_filled`) |
| `name` | Human-readable name |
| `channel` | `EMAIL`, `SMS`, `IN_APP`, or `PUSH` |
| `subject` | Email subject line (Handlebars) |
| `body` | Notification body (Handlebars) |

Pass `templateKey` in `SendNotificationDto` to use a template. The `metadata` object is available as template context.

Example template body:
```
Your order for {{amount}} {{asset}} was filled at {{price}}.
```

---

## Reliability

- All notifications are processed via a Bull job queue with exponential backoff (up to 5 retry attempts).
- Failed deliveries are tracked in `notification_jobs` with the last error message.
- Daily limits per channel/type are enforced via `NotificationPreference.dailyLimit`.
- Alert cooldowns prevent duplicate notifications within a configurable time window.
