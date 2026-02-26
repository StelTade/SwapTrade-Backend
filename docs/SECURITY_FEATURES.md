# Advanced Security Features

## Two-Factor Authentication (2FA)
- Supports TOTP (Google Authenticator, Authy, etc.) and SMS-based codes.
- Users can enable, verify, and disable 2FA via `/auth/2fa/*` endpoints.
- 2FA is required for login if enabled.

## Device/Session Management
- Each login creates a session with device info.
- Users can list all their sessions/devices via `/auth/sessions/list`.
- Sessions can be revoked individually via `/auth/sessions/revoke`.

## Session Revocation
- Revoked sessions are immediately invalidated.
- Users can revoke any session from their session list.

## Endpoints
- `POST /auth/2fa/setup` — Initiate 2FA setup (TOTP or SMS)
- `POST /auth/2fa/verify` — Verify 2FA code
- `POST /auth/2fa/enable` — Enable 2FA after verification
- `POST /auth/2fa/disable` — Disable 2FA
- `POST /auth/sessions/list` — List all user sessions/devices
- `POST /auth/sessions/revoke` — Revoke a session by ID

## Notes
- SMS sending is a placeholder; integrate with a provider for production use.
- All endpoints require authentication except login/register.
