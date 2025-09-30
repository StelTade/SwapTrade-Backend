import { IsString } from 'class-validator';

export class RegisterDto {
  @IsString()
  staffId: string;

  @IsString()
  password: string;
}
