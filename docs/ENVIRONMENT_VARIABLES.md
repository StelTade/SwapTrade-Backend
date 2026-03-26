# Environment Variables

This document describes all environment variables used by the SwapTrade Backend application.

## Application

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | Application environment (`development`, `test`, `staging`, `production`) |
| `PORT` | No | `3000` | Server port |
| `API_PREFIX` | No | `api` | API route prefix |

## Database

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection URL |
| `DATABASE_SSL` | No | `false` | Enable SSL for database connection |

## Redis

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_URL` | Yes | - | Redis connection URL |
| `REDIS_TLS` | No | `false` | Enable TLS for Redis connection |

## JWT

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | Yes | - | Secret key for JWT signing (min 32 chars) |
| `JWT_EXPIRATION` | No | `1d` | JWT token expiration time |

## Stellar

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `STELLAR_HORIZON_URL` | No | `https://horizon-testnet.stellar.org` | Stellar Horizon server URL |
| `STELLAR_NETWORK_PASSPHRASE` | No | `Test SDF Network ; September 2015` | Stellar network passphrase |
| `STELLAR_USDC_ISSUER` | No | - | USDC issuer account ID |
| `STELLAR_POLLING_ENABLED` | No | `false` | Enable Stellar ledger polling |

## Exchange Rate

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `EXCHANGE_RATE_URL` | No | - | Exchange rate API URL |

## Email (SMTP)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SMTP_HOST` | Conditional* | - | SMTP server host |
| `SMTP_PORT` | No | `587` | SMTP server port |
| `SMTP_USER` | Conditional* | - | SMTP username |
| `SMTP_PASS` | Conditional* | - | SMTP password |
| `EMAIL_FROM` | No | - | Sender email address |

*Required in staging/production environments

## Rate Limiting

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RATE_LIMIT_TTL` | No | `60` | Rate limit window in seconds |
| `RATE_LIMIT_MAX` | No | `100` | Max requests per window |

## CORS

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CORS_ORIGINS` | No | `*` | Allowed CORS origins (comma-separated) |

## Logging

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LOG_LEVEL` | No | `info` | Log level (`error`, `warn`, `info`, `debug`, `verbose`) |

## Example .env File

```env
# Application
NODE_ENV=development
PORT=3000
API_PREFIX=api

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/swaptrade
DATABASE_SSL=false

# Redis
REDIS_URL=redis://localhost:6379
REDIS_TLS=false

# JWT
JWT_SECRET=your-super-secret-key-at-least-32-characters-long
JWT_EXPIRATION=1d

# Stellar
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
STELLAR_USDC_ISSUER=GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN
STELLAR_POLLING_ENABLED=true

# Exchange Rate
EXCHANGE_RATE_URL=https://api.exchangerate-api.com/v4/latest/USD

# Email (optional in development)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@swaptrade.com

# Rate Limiting
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=100

# CORS
CORS_ORIGINS=http://localhost:3000,https://swaptrade.com

# Logging
LOG_LEVEL=debug
```

## Security Notes

1. **Never commit `.env` files to version control**
2. Use different values for each environment
3. Rotate secrets regularly
4. Use strong, unique JWT secrets (min 32 characters)
5. In production, use secret management services (AWS Secrets Manager, HashiCorp Vault, etc.)
