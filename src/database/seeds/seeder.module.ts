import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { User } from '../../user/user.entity';
import { UserSeeder } from './user.seeder';
import { MainSeeder } from './main.seeder';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([User]),
  ],
  providers: [UserSeeder, MainSeeder],
  exports: [MainSeeder],
})
export class SeederModule {}
