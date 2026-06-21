import { Module } from '@nestjs/common';
import { DidModule as OriginalDidModule } from '../../did/did.module';
import { IdentityDidAbstractionService } from './identity-did-abstraction.service';

@Module({
  imports: [OriginalDidModule],
  providers: [IdentityDidAbstractionService],
  exports: [OriginalDidModule, IdentityDidAbstractionService],
})
export class IdentityDidModule {}