import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrivacyProfile } from './entities/privacy-profile.entity';
import { EncryptedOrder } from './entities/encrypted-order.entity';
import { PrivacyAuditLog } from './entities/privacy-audit-log.entity';
import { PrivacyController } from './privacy.controller';
import { PrivacyEncryptionService } from './services/privacy-encryption.service';
import { PrivacyZKPService } from './services/privacy-zkp.service';
import { PrivacyProfileService } from './services/privacy-profile.service';
import { EncryptedOrderService } from './services/encrypted-order.service';
import { PrivacyComplianceService } from './services/privacy-compliance.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PrivacyProfile, EncryptedOrder, PrivacyAuditLog]),
  ],
  controllers: [PrivacyController],
  providers: [
    PrivacyEncryptionService,
    PrivacyZKPService,
    PrivacyProfileService,
    EncryptedOrderService,
    PrivacyComplianceService,
  ],
  exports: [
    PrivacyEncryptionService,
    PrivacyZKPService,
    PrivacyProfileService,
    EncryptedOrderService,
    PrivacyComplianceService,
  ],
})
export class PrivacyModule {}
