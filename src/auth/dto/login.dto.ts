import { IsString } from 'class-validator';

export class LoginDto {
  @IsString()
  staffId: string;

  @IsString()
  password: string;
}
