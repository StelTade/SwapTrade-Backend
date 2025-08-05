import { Module } from '@nestjs/common';
import { UserService } from './provider/user-services.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';

import { DataSource } from 'typeorm';
import { Portfolio } from '../portfolio/entities/portfolio.entity';

import { UserController } from './user.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, Portfolio])],
  providers: [UserService],
  controllers: [UserController],
  exports: [UserService, TypeOrmModule],
})
export class UserModule {}
