import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { KycModule as OriginalKycModule } from '../../kyc/kyc.module';
import { KycService } from '../../kyc/kyc.service';
import { IdentityKycService } from './identity-kyc.service';

@Module({
  imports: [OriginalKycModule, EventEmitterModule.forRoot()],
  providers: [IdentityKycService],
  exports: [OriginalKycModule, IdentityKycService, KycService],
})
export class IdentityKycModule {}