import { Module } from '@nestjs/common';

import { UserServices } from './provider/user-services.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UserController } from './user.controller';


@Module({
  imports: [TypeOrmModule.forFeature([UserServices])],
  providers: [UserServices],
   controllers: [UserController],
  exports: [UserServices, TypeOrmModule],
})
export class UserModule {}
