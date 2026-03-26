import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WaitlistReferral, WaitlistReferralPoints } from './entities';
import { ReferralService } from './referral.service';
import { ReferralController } from './referral.controller';
import { WaitlistModule } from '../waitlist/waitlist.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WaitlistReferral, WaitlistReferralPoints]),
    forwardRef(() => WaitlistModule),
  ],
  controllers: [ReferralController],
  providers: [ReferralService],
  exports: [ReferralService],
})
export class ReferralModule {}
