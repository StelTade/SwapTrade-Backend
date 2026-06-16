import { Module } from '@nestjs/common';
import { KycModule as OriginalKycModule } from '../../kyc/kyc.module';

/**
 * Identity KYC Facade Module
 *
 * Wraps the original KycModule from src/kyc/.
 * Provides: KycService, KycStateMachineService, KycController, KycGuard, KycRolesGuard
 */
@Module({
  imports: [OriginalKycModule],
  exports: [OriginalKycModule],
})
export class IdentityKycModule {}
