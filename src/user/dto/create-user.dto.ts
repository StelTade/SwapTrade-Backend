import { IsString, IsEmail, IsEnum, MinLength, MaxLength } from 'class-validator';
import { UserRole } from '../../common/enums/user-role.enum';

export class CreateUserDto {
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  username: string;

  @IsEmail()
  email: string;

  @IsEnum(UserRole)
  role: UserRole;
}
