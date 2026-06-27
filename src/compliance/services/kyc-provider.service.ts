import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  InitiateKycDto,
  KycProvider,
  KycStatus,
  KycWebhookDto,
} from '../dto/kyc-verification.dto';

export interface KycCheckResult {
  checkId: string;
  applicantId: string;
  status: KycStatus;
  provider: KycProvider;
  completedAt?: Date;
  breakdown?: Record<string, unknown>;
}

@Injectable()
export class KycProviderService {
  private readonly logger = new Logger(KycProviderService.name);
  private readonly defaultProvider: KycProvider;

  constructor(private readonly config: ConfigService) {
    this.defaultProvider =
      (this.config.get<string>('KYC_PROVIDER') as KycProvider) ??
      KycProvider.ONFIDO;
  }

  async initiateVerification(dto: InitiateKycDto): Promise<KycCheckResult> {
    const provider = dto.provider ?? this.defaultProvider;
    this.logger.log(`Initiating KYC for user ${dto.userId} via ${provider}`);

    return provider === KycProvider.JUMIO
      ? this.initiateJumio(dto)
      : this.initiateOnfido(dto);
  }

  async handleWebhook(dto: KycWebhookDto): Promise<void> {
    this.logger.log(`KYC webhook: check=${dto.checkId} status=${dto.status}`);
    // Persist status, emit event for downstream unlock + audit log
  }

  async getVerificationStatus(userId: string): Promise<KycCheckResult> {
    this.logger.log(`Fetching KYC status for user ${userId}`);
    // Query provider API or local cache - wired in follow-up
    throw new NotFoundException(`No KYC record found for user ${userId}`);
  }

  private async initiateOnfido(dto: InitiateKycDto): Promise<KycCheckResult> {
    // POST /applicants then POST /checks via Onfido SDK
    // Requires ONFIDO_API_TOKEN in env
    void dto;
    return {
      checkId: 'onfido-check-placeholder',
      applicantId: 'onfido-applicant-placeholder',
      status: KycStatus.PENDING,
      provider: KycProvider.ONFIDO,
    };
  }

  private async initiateJumio(dto: InitiateKycDto): Promise<KycCheckResult> {
    // POST /initiate via Jumio REST API
    // Requires JUMIO_API_TOKEN and JUMIO_API_SECRET in env
    void dto;
    return {
      checkId: 'jumio-check-placeholder',
      applicantId: 'jumio-applicant-placeholder',
      status: KycStatus.PENDING,
      provider: KycProvider.JUMIO,
    };
  }
}
