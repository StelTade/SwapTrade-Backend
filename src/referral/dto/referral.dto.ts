export class CreateReferralDto {
  referrerId: number;
  refereeId: number;
  referralCode: string;
}

export class VerifyReferralDto {
  refereeId: number;
}

export class RewardDistributionDto {
  referralId: number;
  userId: number;
  rewardType: string;
  amount: number;
  recipientType: 'REFERRER' | 'REFEREE';
}
