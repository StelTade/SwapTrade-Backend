import { Module } from '@nestjs/common';
import { UserServices } from './provider/user-services.service';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([UserServices])],
  providers: [UserServices],
  exports: [UserServices, TypeOrmModule],
})
export class UserModule {}
