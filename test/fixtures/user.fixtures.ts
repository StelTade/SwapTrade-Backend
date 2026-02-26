/**
 * Test User Fixtures
 * Factory functions for creating test users with realistic data
 */

import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { User } from '../../src/user/entities/user.entity';

export interface TestUserData {
  email: string;
  password: string;
  username: string;
}

/**
 * Test users for E2E testing
 */
export const TEST_USERS = {
  alice: {
    email: 'alice@test.com',
    password: 'Alice@12345',
    username: 'alice_trader',
  },
  bob: {
    email: 'bob@test.com',
    password: 'Bob@67890',
    username: 'bob_trader',
  },
  charlie: {
    email: 'charlie@test.com',
    password: 'Charlie@11111',
    username: 'charlie_trader',
  },
};

/**
 * Create a test user in database
 */
export async function createTestUser(
  userRepo: Repository<User>,
  userData: TestUserData,
): Promise<User> {
  const existingUser = await userRepo.findOne({
    where: { email: userData.email },
  });

  if (existingUser) {
    return existingUser;
  }

  const passwordHash = await bcrypt.hash(userData.password, 10);
  const user = userRepo.create({
    email: userData.email,
    username: userData.username,
    passwordHash,
    createdAt: new Date(),
  });

  await userRepo.save(user);
  return user;
}

/**
 * Create multiple test users
 */
export async function createTestUsers(
  userRepo: Repository<User>,
  count: number = 3,
): Promise<User[]> {
  const users: User[] = [];
  const userArray = Object.values(TEST_USERS);

  for (let i = 0; i < Math.min(count, userArray.length); i++) {
    const user = await createTestUser(userRepo, userArray[i]);
    users.push(user);
  }

  return users;
}

/**
 * Get test user credentials by name
 */
export function getTestUserCredentials(
  name: keyof typeof TEST_USERS,
): { email: string; password: string } {
  const user = TEST_USERS[name];
  return {
    email: user.email,
    password: user.password,
  };
}

/**
 * Generate unique test user data
 */
export function generateTestUserData(suffix: string): TestUserData {
  return {
    email: `testuser_${suffix}@test.com`,
    password: `TestPass${suffix}@123`,
    username: `user_${suffix}`,
  };
}
