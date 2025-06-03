import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class UserServices {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}
  private readonly logger = new Logger(UserServices.name);

  async findUserByEmail(email: string): Promise<any> {
    this.logger.log(`Finding user by email: ${email}`);
    return null;
  }

  async findUserById(userId: number): Promise<User> {
    this.logger.log(`Finding user by ID: ${userId}`);
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      this.logger.warn(`User with ID ${userId} not found`);
      throw new Error(`User with ID ${userId} not found`);
    }
    this.logger.log(`User found: ${user.email}`);
    return user;
  }

  async updatePassword(userId: number, newPassword: string): Promise<void> {
    // const user = await this.usersRepository.findOne({ where: { id: userId } });
    // const saltRounds = 12;
    // const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    // await this.usersRepository.update(userId, {
    //   password: hashedPassword,
    // });
    // this.logger.log(`Password updated for user ${userId}`);
  }
}
