import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Auth } from './entities/auth.entity';
import { Session } from './entities/session.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Auth, Session])],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
