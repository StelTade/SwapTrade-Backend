import { ApiProperty } from '@nestjs/swagger';
import { WaitlistUserStatus } from '../entities/waitlist-user.entity';

export class WaitlistUserResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ example: 'John Doe', nullable: true })
  name: string | null;

  @ApiProperty({ example: 'ABC123XY' })
  referralCode: string;

  @ApiProperty({ example: 'pending', enum: WaitlistUserStatus })
  status: WaitlistUserStatus;

  @ApiProperty({ example: '2024-01-29T10:30:00.000Z' })
  createdAt: Date;
}

export class SignupWaitlistResponseDto {
  @ApiProperty()
  user: WaitlistUserResponseDto;

  @ApiProperty({ example: 'Verification email sent to user@example.com' })
  message: string;
}

export class VerifyWaitlistResponseDto {
  @ApiProperty()
  user: WaitlistUserResponseDto;

  @ApiProperty({
    example: 'Email verified successfully. You are now on the waitlist!',
  })
  message: string;
}
