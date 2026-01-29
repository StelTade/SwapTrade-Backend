# Quick Reference Guide - Error Handling

## 🚀 Quick Start

### 1. Throw an Exception
```typescript
import { InsufficientBalanceException } from './common/exceptions';

throw new InsufficientBalanceException('BTC', 0.5, 0.2);
```

### 2. Add Swagger Documentation
```typescript
import { ApiBalanceErrorResponses } from './common/decorators/swagger-error-responses.decorator';

@Post('deduct')
@ApiBalanceErrorResponses()
deductBalance(@Body() dto: DeductBalanceDto) { }
```

### 3. Test the Error
```typescript
it('should throw InsufficientBalanceException', async () => {
  const response = await request(app.getHttpServer())
    .post('/api/balance/deduct')
    .send({ asset: 'BTC', amount: 100 });

  expect(response.status).toBe(400);
  expect(response.body.error.code).toBe('INSUFFICIENT_BALANCE');
});
```

---

## 📦 Available Exceptions

| Exception | HTTP | Code | When to Use |
|-----------|------|------|-----------|
| `InsufficientBalanceException` | 400 | `INSUFFICIENT_BALANCE` | User balance too low |
| `InvalidTradeException` | 400 | `INVALID_TRADE` | Invalid trade parameters |
| `ResourceNotFoundException` | 404 | `RESOURCE_NOT_FOUND` | Resource not found |
| `UnauthorizedAccessException` | 403 | `UNAUTHORIZED_ACCESS` | Permission denied |
| `AuthenticationFailedException` | 401 | `AUTHENTICATION_FAILED` | Auth failed |
| `RateLimitExceededException` | 429 | `RATE_LIMIT_EXCEEDED` | Too many requests |
| `ValidationException` | 400 | `VALIDATION_FAILED` | Input validation error |
| `ConflictException` | 409 | `CONFLICT` | Resource already exists |
| `DatabaseException` | 500 | `DATABASE_ERROR` | DB operation failed |
| `ExternalServiceException` | 502 | `EXTERNAL_SERVICE_ERROR` | External service error |
| `TimeoutException` | 408 | `OPERATION_TIMEOUT` | Operation timed out |
| `InvalidStateException` | 400 | `INVALID_STATE_TRANSITION` | Invalid state change |
| `ResourceLockedException` | 423 | `RESOURCE_LOCKED` | Resource locked |

---

## 💡 Common Patterns

### Pattern 1: Check and Throw
```typescript
if (!balance) {
  throw new ResourceNotFoundException('Balance', userId);
}
if (balance.amount < amount) {
  throw new InsufficientBalanceException(asset, amount, balance.amount);
}
```

### Pattern 2: Validate Input
```typescript
if (!email || !password) {
  throw new ValidationException({
    email: !email ? ['Email is required'] : [],
    password: !password ? ['Password is required'] : [],
  });
}
```

### Pattern 3: Handle DB Errors
```typescript
try {
  return await this.repository.save(entity);
} catch (error) {
  throw new DatabaseException(
    'save',
    error instanceof Error ? error.message : 'Unknown error',
  );
}
```

### Pattern 4: Chain Calls
```typescript
try {
  await this.balanceService.deductBalance(userId, asset, amount);
  // throws InsufficientBalanceException - will be caught by filter
} catch (error) {
  if (error instanceof InsufficientBalanceException) {
    throw error;
  }
  throw new DatabaseException('execute', error.message);
}
```

---

## 🎯 Swagger Decorators

### For All Endpoints
```typescript
@ApiErrorResponses()
endpoint() { }
```

### For Balance Endpoints
```typescript
@ApiBalanceErrorResponses()
deductBalance() { }
```

### For Trade Endpoints
```typescript
@ApiTradeErrorResponses()
executeTrade() { }
```

### For Auth Endpoints
```typescript
@ApiAuthErrorResponses()
login() { }
```

---

## 🧪 Testing Pattern

```typescript
describe('Service', () => {
  it('should throw specific exception', async () => {
    expect(async () => {
      await service.operation();
    }).rejects.toThrow(SpecificException);
  });

  it('should return proper error response', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/endpoint')
      .send(invalidData);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('ERROR_CODE');
    expect(res.body.error).toHaveProperty('message');
    expect(res.body.error).toHaveProperty('timestamp');
  });
});
```

---

## 📝 Error Response Examples

### Insufficient Balance
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Insufficient balance for BTC. Required: 0.5, Available: 0.2",
    "timestamp": "2024-01-29T10:30:00.000Z"
  },
  "metadata": {
    "asset": "BTC",
    "required": 0.5,
    "available": 0.2
  }
}
```

### Validation Error
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Request validation failed",
    "timestamp": "2024-01-29T10:30:00.000Z",
    "validationErrors": {
      "email": ["Email must be valid"],
      "password": ["Password must be at least 8 characters"]
    }
  }
}
```

### Not Found
```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "User with identifier 123 not found",
    "timestamp": "2024-01-29T10:30:00.000Z"
  },
  "metadata": {
    "resourceType": "User",
    "identifier": 123
  }
}
```

---

## 🔍 Error Categories

```typescript
import { ErrorCategory, categorizeError } from './common/exceptions/error-codes';

const category = categorizeError('AUTH_001'); // ErrorCategory.AUTHENTICATION
```

Categories:
- `AUTHENTICATION` - Auth failures (401)
- `AUTHORIZATION` - Permission denied (403)
- `VALIDATION` - Input validation (400)
- `NOT_FOUND` - Resource not found (404)
- `CONFLICT` - Resource conflicts (409)
- `BUSINESS_LOGIC` - Business rule violations (400)
- `DATABASE` - DB errors (500)
- `EXTERNAL_SERVICE` - External API errors (502)
- `RATE_LIMIT` - Rate limiting (429)
- `TIMEOUT` - Operation timeout (408)
- `INTERNAL` - Unexpected errors (500)

---

## 📋 Dos and Don'ts

### ✅ DO:
- Throw custom exceptions with context
- Log errors with ErrorLoggerService
- Use validation exceptions for input errors
- Add Swagger decorators to endpoints
- Let GlobalExceptionFilter handle responses

### ❌ DON'T:
- Throw generic Error('message')
- Use console.error instead of logger
- Catch and silently ignore errors
- Expose stack traces in responses
- Return raw error messages to clients

---

## 🔗 Important Files

| File | Purpose |
|------|---------|
| `src/common/exceptions/index.ts` | All exception classes |
| `src/common/exceptions/error-codes.ts` | Error codes and categories |
| `src/common/filters/global-exception.filter.ts` | Global error handling |
| `src/common/logging/error-logger.service.ts` | Error logging |
| `src/common/decorators/swagger-error-responses.decorator.ts` | Swagger docs |
| `docs/ERROR_HANDLING.md` | Full documentation |
| `docs/MIGRATION_GUIDE.md` | Migration instructions |

---

## 🚨 Critical Errors

Errors with status code >= 500 are treated as critical:
- Logged with stack trace (dev only)
- Alerted for monitoring
- Graceful shutdown may be triggered

---

## 📞 Support

1. **Full Documentation**: See [ERROR_HANDLING.md](./docs/ERROR_HANDLING.md)
2. **Migration Guide**: See [MIGRATION_GUIDE.md](./docs/MIGRATION_GUIDE.md)
3. **Examples**: See [error-handling.examples.ts](./src/common/examples/error-handling.examples.ts)
4. **Tests**: See [error-handling.e2e-spec.ts](./test/error-handling.e2e-spec.ts)

---

## Summary

- ✅ Import custom exception
- ✅ Throw with context
- ✅ Let GlobalExceptionFilter catch it
- ✅ Client gets consistent error response
- ✅ Error is logged with full context
- ✅ Swagger documentation is auto-generated

**That's it!** The rest is handled automatically.
