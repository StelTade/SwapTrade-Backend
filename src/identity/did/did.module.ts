import { Module } from '@nestjs/common';
import { DidModule as OriginalDidModule } from '../../did/did.module';

/**
 * Identity DID Facade Module
 *
 * Wraps the original DidModule from src/did/.
 * Provides: DidAuthService, VcIssuerService, ZkpVerifierService, DidController
 */
@Module({
  imports: [OriginalDidModule],
  exports: [OriginalDidModule],
})
export class IdentityDidModule {}
