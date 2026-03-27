export class GenerateReferralCodeResponseDto {
  code: string;
  qrCodeDataUrl: string;
  createdAt: Date;
}

export class GetMyCodeResponseDto {
  code: string;
  qrCodeDataUrl: string;
  isActive: boolean;
  createdAt: Date;
  lastUsedAt: Date | null;
}
