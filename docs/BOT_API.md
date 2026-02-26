# Bot API Usage & Best Practices

## Authentication
- Bots must use an API key with `isBot: true`.
- Pass the API key in the `x-api-key` header for all requests.

## Endpoints
- `POST /bot/trading/swap` — Execute a trade as a bot.
  - Requires a valid bot API key.
  - Body: Same as `/trading/swap` (see `CreateTradeDto`).

## Rate Limits
- Bot trading endpoints are rate-limited (default: 5 requests/minute).
- Exceeding the limit returns HTTP 429 (Too Many Requests).

## Permissions
- Bot API keys can have specific permissions (e.g., `trade`, `read-balance`).
- Only bot API keys can access `/bot/trading/*` endpoints.

## Security
- Keep API keys secret. Rotate keys regularly.
- Monitor usage for unusual activity.

## Monitoring & Abuse
- All bot activity is logged and rate-limited.
- Abuse or violation of terms may result in key revocation.

## Example Request
```http
POST /bot/trading/swap
x-api-key: <BOT_API_KEY>
Content-Type: application/json

{
  "asset": "BTC",
  "amount": 1.5,
  "price": 50000,
  "type": "buy"
}
```
