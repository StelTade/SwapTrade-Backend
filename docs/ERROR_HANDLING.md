# Error Handling & Custom Exceptions Documentation

## Overview

The SwapTrade Backend implements a comprehensive, centralized error handling system that provides:

- **Consistent API error responses** across all endpoints
- **Custom exception classes** for domain-specific errors
- **Global exception filter** for unified error handling
- **Detailed error codes and messages** for client-side error handling
- **Error logging and tracking** with context preservation
- **Swagger documentation** of error responses
- **Prevention of unhandled rejections** at the application level

---

## Error Response Format

All API errors return a consistent JSON response format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "timestamp": "2024-01-29T10:30:00.000Z"
  },
  "metadata": {
    "additionalContext": "Optional metadata"
  }
}
```

### Response Fields

- **success**: Always `false` for error responses
- **error.code**: Machine-readable error code for programmatic handling
- **error.message**: Human-readable error message for display
- **error.timestamp**: ISO 8601 timestamp of the error occurrence
- **metadata**: Optional field containing additional context (varies by error type)

---

## Custom Exception Classes

### Available Exceptions

#### 1. **InsufficientBalanceException** (400 Bad Request)
Thrown when user balance is insufficient for the operation.

```typescript
import { InsufficientBalanceException } from './common/exceptions';

throw new InsufficientBalanceException('BTC', 0.5, 0.2);
```

**Response:**
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

#### 2. **InvalidTradeException** (400 Bad Request)
Thrown for invalid trade operations.

```typescript
import { InvalidTradeException } from './common/exceptions';

throw new InvalidTradeException('Cannot trade with same user');
```

#### 3. **ResourceNotFoundException** (404 Not Found)
Thrown when a resource is not found.

```typescript
import { ResourceNotFoundException } from './common/exceptions';

throw new ResourceNotFoundException('User', userId);
```

#### 4. **UnauthorizedAccessException** (403 Forbidden)
Thrown when user lacks required permissions.

```typescript
import { UnauthorizedAccessException } from './common/exceptions';

throw new UnauthorizedAccessException('view admin dashboard');
```

#### 5. **AuthenticationFailedException** (401 Unauthorized)
Thrown when authentication fails.

```typescript
import { AuthenticationFailedException } from './common/exceptions';

throw new AuthenticationFailedException('Invalid email or password');
```

#### 6. **RateLimitExceededException** (429 Too Many Requests)
Thrown when rate limit is exceeded.

```typescript
import { RateLimitExceededException } from './common/exceptions';

throw new RateLimitExceededException(60); // Retry after 60 seconds
```

#### 7. **ValidationException** (400 Bad Request)
Thrown for validation failures.

```typescript
import { ValidationException } from './common/exceptions';

throw new ValidationException({ email: ['Invalid email format'] });
```

#### 8. **ConflictException** (409 Conflict)
Thrown for resource conflicts or duplicates.

```typescript
import { ConflictException } from './common/exceptions';

throw new ConflictException('Email already registered');
```

#### 9. **DatabaseException** (500 Internal Server Error)
Thrown for database operation errors.

```typescript
import { DatabaseException } from './common/exceptions';

throw new DatabaseException('insert', 'Constraint violation');
```

#### 10. **ExternalServiceException** (502 Bad Gateway)
Thrown for external service errors.

```typescript
import { ExternalServiceException } from './common/exceptions';

throw new ExternalServiceException('Price Feed API', 'Timeout after 30s');
```

#### 11. **TimeoutException** (408 Request Timeout)
Thrown when operations timeout.

```typescript
import { TimeoutException } from './common/exceptions';

throw new TimeoutException('Trade execution');
```

#### 12. **InvalidStateException** (400 Bad Request)
Thrown for invalid state transitions.

```typescript
import { InvalidStateException } from './common/exceptions';

throw new InvalidStateException('PENDING', 'COMPLETED');
```

#### 13. **ResourceLockedException** (423 Locked)
Thrown when a resource is locked.

```typescript
import { ResourceLockedException } from './common/exceptions';

throw new ResourceLockedException('Order', orderId);
```

---

## Error Codes Reference

| Code | HTTP Status | Description | Category |
|------|-------------|-------------|----------|
| AUTH_001 | 401 | Authentication failed | AUTHENTICATION |
| AUTH_002 | 401 | Invalid or expired token | AUTHENTICATION |
| AUTH_003 | 403 | Unauthorized access | AUTHORIZATION |
| BAL_001 | 400 | Insufficient balance | BUSINESS_LOGIC |
| BAL_002 | 400 | Invalid asset | VALIDATION |
| TRD_001 | 400 | Invalid trade operation | BUSINESS_LOGIC |
| VAL_001 | 400 | Validation failed | VALIDATION |
| RLM_001 | 429 | Rate limit exceeded | RATE_LIMIT |
| DB_001 | 500 | Database error | DATABASE |
| EXT_001 | 502 | External service error | EXTERNAL_SERVICE |
| TIM_001 | 408 | Operation timeout | TIMEOUT |

---

## Global Exception Filter

The `GlobalExceptionFilter` catches all exceptions and ensures consistent error responses.

### Features

- ✅ Catches all exception types (custom, HTTP, generic errors)
- ✅ Formats validation errors from `class-validator`
- ✅ Logs errors with full context (request, user, timing)
- ✅ Sanitizes sensitive data in logs
- ✅ Returns consistent error format

### Registration

Automatically registered in `app.module.ts`:

```typescript
import { APP_FILTER } from '@nestjs/core';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

@Module({
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
```

---

## Error Logging

### ErrorLoggerService

Comprehensive error logging with:

- Error categorization
- Context preservation (userId, correlationId, request details)
- Sensitive data sanitization
- Error metrics tracking
- Critical error alerts

### Usage

```typescript
import { ErrorLoggerService } from './common/logging/error-logger.service';

constructor(private readonly errorLogger: ErrorLoggerService) {}

// Automatically logged by GlobalExceptionFilter
// For manual logging:
this.errorLogger.logError(error, request, statusCode, errorCode, metadata);

// Unhandled rejections and uncaught exceptions are logged in main.ts
```

### Log Example

```json
{
  "timestamp": "2024-01-29T10:30:00.000Z",
  "errorCode": "INSUFFICIENT_BALANCE",
  "errorCategory": "BUSINESS_LOGIC",
  "message": "Insufficient balance for BTC. Required: 0.5, Available: 0.2",
  "statusCode": 400,
  "method": "POST",
  "url": "/api/swap/execute",
  "userId": "user123",
  "correlationId": "abc-def-ghi",
  "request": {
    "headers": {
      "authorization": "[REDACTED]",
      "content-type": "application/json"
    },
    "body": {
      "fromAsset": "BTC",
      "amount": 0.5
    }
  },
  "metadata": {
    "asset": "BTC",
    "required": 0.5,
    "available": 0.2
  }
}
```

---

## Swagger Documentation

### ApiErrorResponses Decorator

Use `@ApiErrorResponses()` to document all standard error responses:

```typescript
import { ApiErrorResponses } from './common/decorators/swagger-error-responses.decorator';

@Controller('balance')
export class BalanceController {
  @Get()
  @ApiErrorResponses()
  getUserBalance() {
    // ...
  }
}
```

### Specialized Error Decorators

```typescript
// For balance endpoints
@ApiBalanceErrorResponses()

// For trade endpoints
@ApiTradeErrorResponses()

// For auth endpoints
@ApiAuthErrorResponses()
```

### Documentation Example

Each error response is documented in Swagger with:

- **Status code** and HTTP status
- **Error description**
- **Example response** with error structure

---

## Service Implementation Examples

### Balance Service

```typescript
import { InsufficientBalanceException, InvalidTradeException } from './common/exceptions';

@Injectable()
export class BalanceService {
  async deductBalance(userId: string, asset: string, amount: number) {
    const balance = await this.getBalance(userId, asset);
    
    if (balance < amount) {
      throw new InsufficientBalanceException(asset, amount, balance);
    }
    
    // Update balance...
  }
}
```

### Trade Service

```typescript
@Injectable()
export class TradingService {
  async executeTrade(trade: TradeDto) {
    if (trade.fromAsset === trade.toAsset) {
      throw new InvalidTradeException('Cannot trade same asset for itself');
    }
    
    if (!this.isValidTradeState(trade)) {
      throw new InvalidStateException(
        trade.currentState,
        'EXECUTING'
      );
    }
    
    // Execute trade...
  }
}
```

### Auth Service

```typescript
@Injectable()
export class AuthService {
  async validateCredentials(email: string, password: string) {
    const user = await this.userRepository.findOne({ email });
    
    if (!user || !(await this.comparePasswords(password, user.password))) {
      throw new AuthenticationFailedException('Invalid email or password');
    }
    
    if (this.isRateLimited(email)) {
      throw new RateLimitExceededException(60);
    }
    
    return user;
  }
}
```

---

## Unhandled Rejection Prevention

### Global Handlers

Configured in `main.ts`:

```typescript
// Uncaught exceptions
process.on('uncaughtException', (error) => {
  errorLoggerService.logUncaughtException(error);
  gracefulShutdown('uncaughtException');
});

// Unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  errorLoggerService.logUnhandledRejection(reason, promise);
  gracefulShutdown('unhandledRejection');
});
```

### Best Practices

1. **Always use `try-catch` or `.catch()` with async/await**
```typescript
// Good
try {
  await someAsyncOperation();
} catch (error) {
  throw new DatabaseException('insert', error.message);
}

// Good
somePromise().catch((error) => {
  logger.error('Error:', error);
  throw new ExternalServiceException('API', error.message);
});
```

2. **Throw custom exceptions instead of rejecting**
```typescript
// Good
throw new ValidationException({ field: ['error'] });

// Avoid
throw new Error('Validation failed');
```

3. **Log errors with context**
```typescript
this.logger.error('Operation failed', {
  userId: user.id,
  operation: 'deductBalance',
  asset: 'BTC',
  amount: 0.5,
});
```

---

## Testing Error Handling

### Unit Test Example

```typescript
describe('BalanceService', () => {
  it('should throw InsufficientBalanceException', async () => {
    const service = new BalanceService();
    
    expect(async () => {
      await service.deductBalance('user1', 'BTC', 10);
    }).rejects.toThrow(InsufficientBalanceException);
  });
});
```

### E2E Test Example

```typescript
describe('POST /balance/deduct', () => {
  it('should return 400 with INSUFFICIENT_BALANCE error', async () => {
    const response = await request(app.getHttpServer())
      .post('/balance/deduct')
      .send({ asset: 'BTC', amount: 10 });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INSUFFICIENT_BALANCE');
  });
});
```

---

## Monitoring & Alerts

### Critical Errors

Status codes >= 500 trigger alerts:

```typescript
if (statusCode >= 500) {
  console.error('⚠️ CRITICAL ERROR:', { code, message, statusCode });
  // TODO: Send to monitoring service (Sentry, DataDog, etc.)
}
```

### Error Metrics

- Track error counts by category
- Monitor error rate
- Alert on error spikes
- Track error response times

---

## Migration Guide

### Updating Existing Services

Replace standard error handling with custom exceptions:

```typescript
// Before
throw new Error('Insufficient balance');
throw new BadRequestException('Invalid data');

// After
throw new InsufficientBalanceException(asset, required, available);
throw new ValidationException({ field: ['error'] });
```

---

## Summary

✅ All endpoints return consistent error format  
✅ Errors include descriptive codes and messages  
✅ No unhandled promise rejections in logs  
✅ Comprehensive error logging with context  
✅ Swagger documentation of error responses  
✅ Custom exceptions for domain logic  
✅ Global exception filter for unified handling  

---

## References

- [Exception Filters - NestJS Docs](https://docs.nestjs.com/exception-filters)
- [Custom Providers - NestJS Docs](https://docs.nestjs.com/fundamentals/custom-providers)
- [Swagger - NestJS Docs](https://docs.nestjs.com/openapi/introduction)
