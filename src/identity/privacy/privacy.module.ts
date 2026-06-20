import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrivacyModule as OriginalPrivacyModule } from '../../privacy/privacy.module';
import { IdentityPrivacyService } from './identity-privacy.service';

@Module({
  imports: [OriginalPrivacyModule, EventEmitterModule.forRoot()],
  providers: [IdentityPrivacyService],
  exports: [OriginalPrivacyModule, IdentityPrivacyService],
})
export class IdentityPrivacyModule {}