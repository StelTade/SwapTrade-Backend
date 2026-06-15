/**
 * Cycle 10 Resolution Pattern: user ↔ balance
 * 
 * Problem: user → balance → user (bidirectional dependency)
 * Solution: Interface Segregation + Dependency Injection
 * 
 * User module provides minimal interface to balance module
 * Balance module only sees IUserIdentity, not full UserService
 * User listens to balance events for updates
 */

/**
 * Shared Interface - Level 0 (Shared Layer)
 * file: src/shared/interfaces/user-identity.interface.ts
 */

export interface IUserIdentity {
  id: string;
  email: string;
  status: 'active' | 'inactive' | 'suspended';
  kycVerified: boolean;
  createdAt: Date;
}

/**
 * Balance Module - Level 1 (Infrastructure)
 * file: src/infrastructure/database/balance.service.ts
 * 
 * BEFORE (WRONG - Circular):
 * import { UserService } from '../../identity/user/user.service';
 * 
 * AFTER (CORRECT):
 * import { Inject } from '@nestjs/common';
 */

// Example: BalanceService after refactoring
export class BalanceServiceRefactored {
  constructor(
    @Inject('IUserIdentity') private userIdentity: IUserIdentity,
    private eventEmitter: any,
  ) {}

  async validateUserBalance(userId: string, amount: number): Promise<boolean> {
    // Use IUserIdentity interface, not full UserService
    // No circular dependency!
    const user = this.userIdentity; // Would be injected implementation
    if (user.status !== 'active') {
      throw new Error('User not active');
    }
    return true;
  }

  async updateBalance(userId: string, delta: number): Promise<void> {
    // Update balance logic
    // Emit event for user module to listen to
    this.eventEmitter.emit('balance.updated', {
      userId,
      delta,
      timestamp: new Date(),
    });
  }
}

/**
 * User Module - Level 2 (Identity)
 * file: src/identity/user/user.module.ts
 * 
 * Provides IUserIdentity implementation to BalanceModule
 * Exports the interface for dependency injection
 */

export class UserModuleConfig {
  // In UserModule decorator:
  // @Module({
  //   providers: [
  //     UserService,
  //     {
  //       provide: 'IUserIdentity',
  //       useClass: UserService,
  //     },
  //   ],
  //   exports: ['IUserIdentity'],
  // })

  // UserService implements IUserIdentity interface
  // Other modules inject 'IUserIdentity' token, not UserService
}

/**
 * User Service - Now listens to balance events
 * file: src/identity/user/user.service.ts
 */

export class UserServiceRefactored {
  constructor(private eventEmitter: any) {}

  // Subscribe to balance events (no import of balance module)
  onModuleInit() {
    this.eventEmitter.on('balance.updated', (event: unknown) => {
      this.handleBalanceUpdated(event);
    });
  }

  private handleBalanceUpdated(event: any): void {
    // React to balance update without importing balance module
    // Update user profile cache, emit notification, etc.
  }
}

/**
 * Module Dependencies After Refactoring
 * 
 * BEFORE (WITH CYCLE):
 * user → balance → user ✗
 * 
 * AFTER (CLEAN):
 * user → [provides IUserIdentity] → balance (one-way)
 * user ← [listens to] ← balance (one-way events)
 * Total: TWO one-way dependencies instead of circular
 */
