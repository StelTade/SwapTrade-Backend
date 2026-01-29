# Migration Guide: Updating Existing Services with Error Handling

This guide helps you migrate existing services to use the new comprehensive error handling system.

## Step 1: Update Imports

Replace old error handling imports with new custom exceptions:

```typescript
// BEFORE
import { BadRequestException, NotFoundException } from '@nestjs/common';

// AFTER
import {
  InsufficientBalanceException,
  InvalidTradeException,
  ResourceNotFoundException,
  ValidationException,
  DatabaseException,
} from '../common/exceptions';
import { ErrorLoggerService } from '../common/logging/error-logger.service';
```

## Step 2: Add ErrorLoggerService to Service

Inject the ErrorLoggerService in the constructor:

```typescript
// BEFORE
@Injectable()
export class BalanceService {
  constructor(
    @InjectRepository(Balance)
    private readonly balanceRepository: Repository<Balance>,
  ) {}
}

// AFTER
@Injectable()
export class BalanceService {
  constructor(
    @InjectRepository(Balance)
    private readonly balanceRepository: Repository<Balance>,
    private readonly errorLogger: ErrorLoggerService,
  ) {}
}
```

## Step 3: Replace Generic Errors with Custom Exceptions

### Insufficient Balance Scenario

```typescript
// BEFORE
async deductBalance(userId: string, asset: string, amount: number) {
  const balance = await this.balanceRepository.findOne({ userId, asset });
  
  if (!balance || balance.amount < amount) {
    throw new BadRequestException('Insufficient balance');
  }
  
  balance.amount -= amount;
  return this.balanceRepository.save(balance);
}

// AFTER
async deductBalance(userId: string, asset: string, amount: number) {
  const balance = await this.balanceRepository.findOne({ userId, asset });
  
  if (!balance) {
    throw new ResourceNotFoundException('Balance', `${userId}:${asset}`);
  }
  
  if (balance.amount < amount) {
    throw new InsufficientBalanceException(asset, amount, balance.amount, {
      userId,
      requestedAmount: amount,
      availableAmount: balance.amount,
    });
  }
  
  balance.amount -= amount;
  return this.balanceRepository.save(balance);
}
```

### Resource Not Found Scenario

```typescript
// BEFORE
async getUser(userId: string) {
  const user = await this.userRepository.findOne(userId);
  if (!user) {
    throw new NotFoundException('User not found');
  }
  return user;
}

// AFTER
async getUser(userId: string) {
  const user = await this.userRepository.findOne(userId);
  if (!user) {
    throw new ResourceNotFoundException('User', userId);
  }
  return user;
}
```

### Validation Error Scenario

```typescript
// BEFORE
async createUser(createUserDto: CreateUserDto) {
  if (!createUserDto.email || !createUserDto.password) {
    throw new BadRequestException('Email and password are required');
  }
  
  if (createUserDto.password.length < 8) {
    throw new BadRequestException('Password must be at least 8 characters');
  }
  
  return this.userRepository.save(createUserDto);
}

// AFTER
async createUser(createUserDto: CreateUserDto) {
  const errors = {};
  
  if (!createUserDto.email) {
    errors['email'] = ['Email is required'];
  }
  
  if (!createUserDto.password) {
    errors['password'] = ['Password is required'];
  }
  
  if (createUserDto.password?.length < 8) {
    errors['password'] = ['Password must be at least 8 characters'];
  }
  
  if (Object.keys(errors).length > 0) {
    throw new ValidationException(errors);
  }
  
  return this.userRepository.save(createUserDto);
}
```

### Database Error Scenario

```typescript
// BEFORE
async executeQuery(query: string) {
  try {
    return await this.database.query(query);
  } catch (error) {
    throw new InternalServerErrorException('Database operation failed');
  }
}

// AFTER
async executeQuery(query: string) {
  try {
    return await this.database.query(query);
  } catch (error) {
    throw new DatabaseException(
      'executeQuery',
      error instanceof Error ? error.message : 'Unknown error',
      { query },
    );
  }
}
```

## Step 4: Add Try-Catch Blocks with Proper Error Handling

```typescript
// BEFORE
async processOrder(orderId: string) {
  const order = await this.orderRepository.findOne(orderId);
  await this.balanceService.deductBalance(order.userId, order.amount);
  order.status = 'PROCESSED';
  return this.orderRepository.save(order);
}

// AFTER
async processOrder(orderId: string) {
  try {
    const order = await this.orderRepository.findOne(orderId);
    
    if (!order) {
      throw new ResourceNotFoundException('Order', orderId);
    }
    
    // This may throw InsufficientBalanceException
    await this.balanceService.deductBalance(
      order.userId,
      order.asset,
      order.amount,
    );
    
    order.status = 'PROCESSED';
    
    try {
      return await this.orderRepository.save(order);
    } catch (error) {
      throw new DatabaseException(
        'save',
        error instanceof Error ? error.message : 'Unknown error',
        { orderId },
      );
    }
  } catch (error) {
    // Custom exceptions are automatically handled by GlobalExceptionFilter
    if (
      error instanceof ResourceNotFoundException ||
      error instanceof InsufficientBalanceException ||
      error instanceof DatabaseException
    ) {
      throw error;
    }
    
    // Log unexpected errors
    this.errorLogger.logError(
      error,
      undefined,
      500,
      'PROCESS_ORDER_ERROR',
      { orderId },
    );
    
    throw new DatabaseException(
      'processOrder',
      'An unexpected error occurred',
      { orderId },
    );
  }
}
```

## Step 5: Update Service Tests

```typescript
// BEFORE
describe('BalanceService', () => {
  it('should throw error when balance is insufficient', async () => {
    expect(async () => {
      await service.deductBalance('user1', 'BTC', 100);
    }).rejects.toThrow();
  });
});

// AFTER
describe('BalanceService', () => {
  it('should throw InsufficientBalanceException when balance is insufficient', async () => {
    expect(async () => {
      await service.deductBalance('user1', 'BTC', 100);
    }).rejects.toThrow(InsufficientBalanceException);
  });
  
  it('should include metadata in InsufficientBalanceException', async () => {
    try {
      await service.deductBalance('user1', 'BTC', 100);
    } catch (error) {
      expect(error).toBeInstanceOf(InsufficientBalanceException);
      expect(error.metadata).toHaveProperty('asset');
      expect(error.metadata).toHaveProperty('required');
      expect(error.metadata).toHaveProperty('available');
    }
  });
});
```

## Step 6: Update Controller Documentation

Add Swagger documentation for error responses:

```typescript
// BEFORE
@Controller('balance')
export class BalanceController {
  @Post('deduct')
  deductBalance(@Body() dto: DeductBalanceDto) {
    return this.balanceService.deductBalance(dto.userId, dto.asset, dto.amount);
  }
}

// AFTER
import { ApiBalanceErrorResponses } from '../common/decorators/swagger-error-responses.decorator';

@Controller('balance')
export class BalanceController {
  @Post('deduct')
  @ApiBalanceErrorResponses()
  @ApiResponse({
    status: 200,
    description: 'Balance deducted successfully',
    schema: {
      example: {
        success: true,
        data: {
          id: 'bal_123',
          userId: 'user123',
          asset: 'BTC',
          amount: 4.5,
        },
      },
    },
  })
  deductBalance(@Body() dto: DeductBalanceDto) {
    return this.balanceService.deductBalance(dto.userId, dto.asset, dto.amount);
  }
}
```

## Step 7: Migration Checklist

- [ ] Update all imports to use new exception classes
- [ ] Inject ErrorLoggerService in services that don't have it
- [ ] Replace BadRequestException with appropriate custom exceptions
- [ ] Replace NotFoundException with ResourceNotFoundException
- [ ] Replace InternalServerErrorException with DatabaseException or appropriate exception
- [ ] Add try-catch blocks where needed
- [ ] Update service unit tests
- [ ] Add controller Swagger documentation
- [ ] Test endpoints for proper error responses
- [ ] Update integration tests
- [ ] Verify error logs are captured correctly
- [ ] Test unhandled rejection handling

## Service-by-Service Migration Order

**Recommended order for migration:**

1. **Balance Service** - High impact, frequently used
2. **Auth Service** - Critical for security
3. **Trading Service** - Complex logic with many error scenarios
4. **User Service** - Basic CRUD operations
5. **Notification Service** - Lower priority
6. **Portfolio Service** - Medium complexity
7. **Remaining services** - As time permits

## Common Pitfalls to Avoid

### ❌ Don't do this:

```typescript
// Wrong: Catching and throwing generic error
try {
  await operation();
} catch (error) {
  throw new Error('Operation failed');
}

// Wrong: Not providing context
throw new ValidationException({ field: ['error'] });

// Wrong: Swallowing exceptions
try {
  await operation();
} catch (error) {
  console.log(error); // Silent failure!
}

// Wrong: Logging and throwing
try {
  await operation();
} catch (error) {
  console.error(error);
  throw new Error('Operation failed'); // Already logged, don't throw generic
}
```

### ✅ Do this instead:

```typescript
// Correct: Let custom exception propagate
try {
  await this.deductBalance(userId, asset, amount); // throws InsufficientBalanceException
} catch (error) {
  if (error instanceof InsufficientBalanceException) {
    throw error; // Re-throw custom exception
  }
  throw new DatabaseException('deductBalance', error.message);
}

// Correct: Provide context in metadata
throw new ValidationException(
  { email: ['Invalid format'] },
  { attemptedEmail: email },
);

// Correct: Handle all error cases
try {
  await operation();
} catch (error) {
  if (error instanceof CustomException) {
    throw error;
  }
  this.errorLogger.logError(error, undefined, 500, 'OPERATION_FAILED');
  throw new DatabaseException('operation', error.message);
}

// Correct: Don't log twice
try {
  await operation();
} catch (error) {
  // GlobalExceptionFilter will log, just throw
  throw new DatabaseException('operation', error.message);
}
```

## Testing Migration

After migration, ensure all error scenarios are tested:

```typescript
describe('Service Migration Verification', () => {
  it('should throw appropriate custom exceptions', async () => {
    expect(() => service.operation()).rejects.toThrow(CustomException);
  });

  it('should include metadata in exceptions', async () => {
    try {
      await service.operation();
    } catch (error) {
      expect(error.metadata).toBeDefined();
    }
  });

  it('should return consistent error response format', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/endpoint')
      .send(invalidData);
    
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toHaveProperty('code');
    expect(response.body.error).toHaveProperty('message');
    expect(response.body.error).toHaveProperty('timestamp');
  });
});
```

## Rollout Strategy

1. **Phase 1**: Migrate core services (Balance, Auth)
2. **Phase 2**: Migrate business logic services (Trading, User)
3. **Phase 3**: Migrate utility services (Notification, Portfolio)
4. **Phase 4**: Update and test all controllers
5. **Phase 5**: Production deployment with monitoring

## Support & Questions

- Refer to [ERROR_HANDLING.md](./ERROR_HANDLING.md) for detailed documentation
- Check [error-handling.examples.ts](../src/common/examples/error-handling.examples.ts) for implementation examples
- Review [error-handling.e2e-spec.ts](../test/error-handling.e2e-spec.ts) for test patterns
