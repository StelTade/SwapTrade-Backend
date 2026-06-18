import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DidDocument } from './entities/did-document.entity';
import { VerifiableCredential } from './entities/verifiable-credential.entity';
import { DidAuthService } from './services/did-auth.service';
import { VcIssuerService } from './services/vc-issuer.service';
import { ZkpVerifierService } from './services/zkp-verifier.service';
import { DidController } from './controllers/did.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DidDocument, VerifiableCredential])],
  controllers: [DidController],
  providers: [DidAuthService, VcIssuerService, ZkpVerifierService],
  exports: [DidAuthService, VcIssuerService, ZkpVerifierService],
})
export class DidModule {}
