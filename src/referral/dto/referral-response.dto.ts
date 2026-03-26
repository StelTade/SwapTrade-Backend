import { ApiProperty } from '@nestjs/swagger';
import { ReferralStatus } from '../entities/waitlist-referral.entity';

export class ReferralResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  referrerId: number;

  @ApiProperty({ example: 2 })
  refereeId: number;

  @ApiProperty({ example: 'ABC123XY' })
  referralCode: string;

  @ApiProperty({ example: 'verified', enum: ReferralStatus })
  status: ReferralStatus;

  @ApiProperty({ example: '192.168.1.1', nullable: true })
  refereeIP: string | null;

  @ApiProperty({ example: '2024-01-29T10:30:00.000Z', nullable: true })
  verifiedAt: Date | null;

  @ApiProperty({ example: '2024-01-29T10:35:00.000Z', nullable: true })
  rewardedAt: Date | null;

  @ApiProperty({ example: '2024-01-29T10:30:00.000Z' })
  createdAt: Date;
}

export class ReferralPointsResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  userId: number;

  @ApiProperty({ example: 1 })
  points: number;

  @ApiProperty({ example: 'REFERRAL_SIGNUP' })
  reason: string;

  @ApiProperty({ example: 1, nullable: true })
  referralId: number | null;

  @ApiProperty({ example: 'Referral signup bonus' })
  description: string | null;

  @ApiProperty({ example: 'TXN-123456789' })
  transactionRef: string;

  @ApiProperty({ example: '2024-01-29T10:30:00.000Z' })
  createdAt: Date;
}

export class ReferralListResponseDto {
  @ApiProperty({ type: [ReferralResponseDto] })
  referrals: ReferralResponseDto[];

  @ApiProperty({ example: 5 })
  total: number;
}

export class UserReferralStatsDto {
  @ApiProperty({ example: 1 })
  userId: number;

  @ApiProperty({ example: 10 })
  totalReferrals: number;

  @ApiProperty({ example: 8 })
  verifiedReferrals: number;

  @ApiProperty({ example: 8 })
  totalPoints: number;

  @ApiProperty({ type: [ReferralPointsResponseDto] })
  pointsHistory: ReferralPointsResponseDto[];
}
