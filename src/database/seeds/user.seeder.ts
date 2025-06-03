import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../user/user.entity';
import { Seeder } from './seeder.interface';
import { UserFactory } from './factories/user.factory';

/**
 * Seeder for User entities
 */
@Injectable()
export class UserSeeder implements Seeder {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Seed users into the database
   */
  async seed(): Promise<void> {
    // Create admin user
    const adminUser = await UserFactory.getInstance().create({
      firstname: 'Admin',
      lastname: 'User',
      email: 'admin@swaptrade.com',
    });

    // Create regular users
    const regularUsers = await UserFactory.getInstance().createMany(5);

    // Save all users to the database
    await this.userRepository.save([adminUser, ...regularUsers]);
  }

  /**
   * Clear all users from the database
   */
  async clear(): Promise<void> {
    await this.userRepository.delete({});
  }
}
