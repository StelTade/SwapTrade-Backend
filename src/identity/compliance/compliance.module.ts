import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ComplianceModule as OriginalComplianceModule } from '../../compliance/compliance.module';
import { IdentityComplianceService } from './identity-compliance.service';

@Module({
  imports: [OriginalComplianceModule, EventEmitterModule.forRoot()],
  providers: [IdentityComplianceService],
  exports: [OriginalComplianceModule, IdentityComplianceService],
})
export class IdentityComplianceModule {}