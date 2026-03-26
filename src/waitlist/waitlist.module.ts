import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WaitlistUser, VerificationToken } from './entities';
import { WaitlistService } from './waitlist.service';
import { WaitlistController } from './waitlist.controller';
import { ReferralModule } from '../referral/referral.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WaitlistUser, VerificationToken]),
    forwardRef(() => ReferralModule),
  ],
  controllers: [WaitlistController],
  providers: [WaitlistService],
  exports: [WaitlistService],
})
export class WaitlistModule {}
