import { User } from '../../src/user/entities/user.entity';
import { faker } from '@faker-js/faker';

export class UserFactory {
  static create(overrides: Partial<User> = {}): User {
    const user = new User();
    user.id = overrides.id || faker.number.int({ min: 1, max: 10000 });
    user.email = overrides.email || faker.internet.email();
    user.username = overrides.username || faker.internet.userName();
    user.passwordHash = overrides.passwordHash || faker.internet.password();
    user.createdAt = overrides.createdAt || new Date();
    user.isActive = overrides.isActive !== undefined ? overrides.isActive : true;
    user.roles = overrides.roles || ['user'];
    return user;
  }

  static createMany(count: number, overrides: Partial<User> = {}): User[] {
    return Array.from({ length: count }).map(() => this.create(overrides));
  }
}