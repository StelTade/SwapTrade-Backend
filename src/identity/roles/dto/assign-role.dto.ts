import { IsEnum, IsArray, ArrayNotEmpty, ArrayUnique, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../enums/user-role.enum';

export class AssignRoleDto {
  @ApiProperty({ description: 'Target user ID' })
  @IsNumber()
  userId: number;

  @ApiProperty({ enum: UserRole, isArray: true, description: 'Roles to assign' })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(UserRole, { each: true })
  roles: UserRole[];
}

export class RevokeRoleDto {
  @ApiProperty({ description: 'Target user ID' })
  @IsNumber()
  userId: number;

  @ApiProperty({ enum: UserRole, isArray: true, description: 'Roles to revoke' })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(UserRole, { each: true })
  roles: UserRole[];
}
