import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../user.entity';
import { Repository } from 'typeorm';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const user = this.usersRepository.create(createUserDto);
    const savedUser = await this.usersRepository.save(user);
    this.logger.log(`Created new user with id ${savedUser.id}`);
    return savedUser;
  }

  async findAll(): Promise<User[]> {
    this.logger.log(`Retrieving all users`);
    return this.usersRepository.find();
  }

  async findOne(id: number): Promise<User> {
    this.logger.log(`Finding user by id: ${id}`);
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      this.logger.warn(`User with id ${id} not found`);
      throw new NotFoundException(`User with id ${id} not found`);
    }
    return user;
  }

  async update(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    this.logger.log(`Updating user with id: ${id}`);
    const user = await this.usersRepository.preload({
      id,
      ...updateUserDto,
    });

    if (!user) {
      this.logger.warn(`User with id ${id} not found`);
      throw new NotFoundException(`User with id ${id} not found`);
    }
    return this.usersRepository.save(user);
  }

  async remove(id: number): Promise<User> {
    this.logger.log(`Removing user with id: ${id}`);
    const user = await this.findOne(id);
    await this.usersRepository.remove(user);
    return user;
  }

  async findUserByEmail(email: string): Promise<User | null> {
    this.logger.log(`Finding user by email: ${email}`);
    return this.usersRepository.findOne({ where: { email } });
  }

  async updatePassword(userId: number, newPassword: string): Promise<void> {
    this.logger.log(`Updating password for user id: ${userId}`);
    await this.usersRepository.update(userId, { password: newPassword });
  }
  async banUser(id: number): Promise<User> {
    this.logger.log(`Banning user with id: ${id}`);
    const user = await this.findOne(id);
    user.isBanned = true;
    user.isActive = false;
    return this.usersRepository.save(user);
  }

  async activateUser(id: number): Promise<User> {
    this.logger.log(`Activating user with id: ${id}`);
    const user = await this.findOne(id);
    user.isActive = true;
    user.isBanned = false;
    return this.usersRepository.save(user);
  }

  async deactivateUser(id: number): Promise<User> {
    this.logger.log(`Deactivating user with id: ${id}`);
    const user = await this.findOne(id);
    user.isActive = false;
    return this.usersRepository.save(user);
  }
}
