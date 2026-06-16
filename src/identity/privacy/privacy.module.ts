import { Module } from '@nestjs/common';
import { PrivacyModule as OriginalPrivacyModule } from '../../privacy/privacy.module';

/**
 * Identity Privacy Facade Module
 *
 * Wraps the original PrivacyModule from src/privacy/.
 * Provides: PrivacyEncryptionService, PrivacyZKPService, PrivacyProfileService,
 *           EncryptedOrderService, PrivacyComplianceService, PrivacyController
 */
@Module({
  imports: [OriginalPrivacyModule],
  exports: [OriginalPrivacyModule],
})
export class IdentityPrivacyModule {}
