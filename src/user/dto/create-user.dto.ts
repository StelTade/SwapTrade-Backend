import { IsString, IsEmail, IsEnum } from 'class-validator';
import { UserRole } from '../../common/enums/user-role.enum';

export class CreateUserDto {
  @IsString()
  username: string;

  @IsEmail()
  email: string;

  @IsEnum(UserRole)
  role: UserRole;
}
