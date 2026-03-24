import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WaitlistController } from './waitlist.controller';
import { WaitlistService } from './waitlist.service';
import { WaitlistUser } from './entities/waitlist-user.entity';
import { VerificationToken } from './entities/verification-token.entity';

@Module({
  imports: [TypeOrmModule.forFeature([WaitlistUser, VerificationToken])],
  controllers: [WaitlistController],
  providers: [WaitlistService],
  exports: [WaitlistService],
})
export class WaitlistModule {}
