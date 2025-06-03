import { BaseFactory } from './base.factory';
import { User } from '../../../user/user.entity';
import * as bcrypt from 'bcrypt';

/**
 * Factory for generating User entities
 */
export class UserFactory extends BaseFactory<User> {
  private static instance: UserFactory;

  private constructor() {
    super();
  }

  /**
   * Get the singleton instance of UserFactory
   */
  static getInstance(): UserFactory {
    if (!UserFactory.instance) {
      UserFactory.instance = new UserFactory();
    }
    return UserFactory.instance;
  }

  /**
   * Create a user with random data
   * @param overrides - Optional properties to override in the generated user
   */
  async create(overrides?: Partial<User>): Promise<User> {
    const firstName = overrides?.firstname || this.generateRandomName();
    const lastName = overrides?.lastname || this.generateRandomName();
    const email = overrides?.email || `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`;
    
    // Hash the password if provided, otherwise use a default hashed password
    const password = overrides?.password 
      ? await this.hashPassword(overrides.password)
      : await this.hashPassword('password123');

    const user = new User();
    user.firstname = firstName;
    user.lastname = lastName;
    user.email = email;
    user.password = password;

    return user;
  }

  /**
   * Create multiple users with random data
   * @param count - Number of users to create
   * @param overrides - Optional properties to override in all generated users
   */
  async createMany(count: number, overrides?: Partial<User>): Promise<User[]> {
    const users: User[] = [];
    for (let i = 0; i < count; i++) {
      users.push(await this.create(overrides));
    }
    return users;
  }

  /**
   * Generate a random name
   */
  private generateRandomName(): string {
    const names = [
      'John', 'Jane', 'Alice', 'Bob', 'Charlie', 'Diana', 'Edward', 'Fiona',
      'George', 'Hannah', 'Ian', 'Julia', 'Kevin', 'Laura', 'Michael', 'Natalie',
      'Oliver', 'Patricia', 'Quentin', 'Rachel', 'Samuel', 'Tina', 'Ulysses', 'Victoria',
      'William', 'Xena', 'Yasmine', 'Zachary'
    ];
    return names[Math.floor(Math.random() * names.length)];
  }

  /**
   * Hash a password using bcrypt
   */
  private async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt();
    return bcrypt.hash(password, salt);
  }
}
