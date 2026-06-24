export { IdentityKycModule } from './kyc.module';
export { KycModule } from '../../kyc/kyc.module';
export { KycService } from '../../kyc/kyc.service';
export { IdentityKycService, KYC_EVENTS } from './identity-kyc.service';
export type {
  KycSubmittedEvent,
  KycApprovedEvent,
  KycRejectedEvent,
} from './identity-kyc.service';
