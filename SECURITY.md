# SwapTrade Backend Security Overview

## Goals

- Protect user accounts and trading operations against common web threats (OWASP Top 10).
- Provide layered defenses: network, application, and data layers.
- Enable observability and auditability of security-relevant events.

## Implemented Controls

- CSRF protection via signed token in HTTP-only cookie and header validation.
- Security headers with Helmet:
  - Content-Security-Policy
  - HSTS
  - X-Frame-Options (frameguard)
  - Referrer-Policy
  - Basic XSS protections
- Global API versioning (`/api/v1` prefix).
- Authentication using bcryptjs password hashing.
- API key support:
  - `ApiKey` entity with `active`, `expiresAt`, and `lastUsedAt`.
  - `ApiKeyGuard` that validates `x-api-key` header and tracks usage.
- IP whitelisting guard for admin endpoints via `ADMIN_IP_WHITELIST`.
- HMAC request signing utilities for critical operations.
- CSRF and cookie parsing wired in `main.ts`.
- Audit logging:
  - `AuditLog` entity and `AuditLogService` for recording user actions, IPs, and metadata.

## Further Hardening (Planned)

The following controls have integration hooks in the codebase but require environment-specific configuration and/or external services:

- Multi-factor authentication (MFA) for sensitive operations using TOTP.
- OAuth2/OpenID Connect integration with an external identity provider.
- Secrets management with HashiCorp Vault or equivalent.
- Endpoint-level encryption for sensitive payloads (e.g. KMS-backed AES).
- Centralized rate limiting across IP/user/endpoint layers using NestJS Throttler.
- Automated dependency vulnerability scanning in CI (e.g. `npm audit`, Snyk, or OWASP Dependency-Check).
- OWASP ZAP or similar dynamic application security testing in CI.

## Threat Model (High Level)

- **Authentication/Authorization**
  - Risk: Credential stuffing and weak passwords.
  - Mitigation: bcryptjs hashing; planned MFA and external IdP support.

- **Injection**
  - Risk: SQL injection and command injection.
  - Mitigation: TypeORM parameter binding; no raw SQL by default; planned audits and tests.

- **Cross-Site Scripting (XSS)**
  - Risk: Malicious scripts in browser context.
  - Mitigation: Helmet CSP and XSS protections; strict JSON APIs (no HTML rendering).

- **Cross-Site Request Forgery (CSRF)**
  - Risk: Forged state-changing requests from third-party origins.
  - Mitigation: CSRF token middleware with HTTP-only cookie + header validation.

- **Sensitive Data Exposure**
  - Risk: Interception or leakage of credentials and trading data.
  - Mitigation: TLS termination at the edge; password hashing; planned field-level encryption and Vault.

- **Rate-Limiting and Abuse**
  - Risk: Brute-force login, enumeration, or resource exhaustion.
  - Mitigation: Hooks for NestJS Throttler; per-endpoint and per-user limits to be configured.

Review and extend this document as new controls are implemented and as the platform’s threat landscape evolves.

