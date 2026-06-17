import { IsEmail, IsString, MinLength, Matches, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'john@example.com', description: 'Registered email address' })
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'abc123token', description: 'Password reset token received by email' })
  @IsString()
  @IsNotEmpty({ message: 'Reset token is required' })
  token: string;

  @ApiProperty({
    example: 'NewStrongPassword1!',
    description: 'New password (min 8 chars, uppercase, number, special character)',
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(/[A-Z]/, { message: 'Password must contain an uppercase letter' })
  @Matches(/[0-9]/, { message: 'Password must contain a number' })
  @Matches(/[^A-Za-z0-9]/, {
    message: 'Password must contain a special character',
  })
  newPassword: string;
}

export class ChangePasswordDto {
  @ApiProperty({ example: 'CurrentPassword1!', description: 'Current password' })
  @IsString()
  @IsNotEmpty({ message: 'Current password is required' })
  currentPassword: string;

  @ApiProperty({
    example: 'NewStrongPassword1!',
    description: 'New password (min 8 chars, uppercase, number, special character)',
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(/[A-Z]/, { message: 'Password must contain an uppercase letter' })
  @Matches(/[0-9]/, { message: 'Password must contain a number' })
  @Matches(/[^A-Za-z0-9]/, {
    message: 'Password must contain a special character',
  })
  newPassword: string;
}
