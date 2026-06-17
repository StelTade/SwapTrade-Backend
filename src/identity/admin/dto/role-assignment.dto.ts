import { IsNotEmpty, IsString } from 'class-validator';
import { UserRole } from '../../roles/enums/user-role.enum';

export class RoleAssignmentDto {
  @IsNotEmpty()
  @IsString()
  role: UserRole;
}