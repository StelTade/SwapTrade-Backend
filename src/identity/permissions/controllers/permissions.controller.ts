import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PermissionManagementService } from '../services/permission-management.service';
import { RoleManagementService } from '../../roles/services/role-management.service';
import { Roles } from '../../roles/decorators/roles.decorator';
import { RequirePermissions } from '../decorators/require-permissions.decorator';
import { RbacGuard } from '../../roles/guards/rbac.guard';
import { UserRole } from '../../roles/enums/user-role.enum';
import { IsArray, IsEnum, IsString, ArrayNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class AssignPermissionsToRoleDto {
  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  roleName: UserRole;

  @ApiProperty({ isArray: true, type: String })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  permissionSlugs: string[];
}

@ApiTags('Identity / Permissions')
@ApiBearerAuth()
@UseGuards(RbacGuard)
@Controller('identity/permissions')
export class PermissionsController {
  constructor(
    private readonly permissionService: PermissionManagementService,
    private readonly roleManagement: RoleManagementService,
  ) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.COMPLIANCE_OFFICER)
  @RequirePermissions('permissions.read')
  @ApiOperation({ summary: 'List all active permissions' })
  findAll() {
    return this.permissionService.findAll();
  }

  @Get(':slug')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @RequirePermissions('permissions.read')
  @ApiOperation({ summary: 'Get a specific permission by slug' })
  @ApiParam({ name: 'slug', example: 'users.read' })
  findOne(@Param('slug') slug: string) {
    return this.permissionService.findBySlug(slug);
  }

  @Post('assign-to-role')
  @Roles(UserRole.SUPER_ADMIN)
  @RequirePermissions('permissions.manage')
  @ApiOperation({ summary: 'Assign permissions to a role (SUPER_ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Permissions assigned to role' })
  assignToRole(@Body() dto: AssignPermissionsToRoleDto, @Request() req: any) {
    return this.roleManagement.assignPermissionsToRole(
      dto.roleName,
      dto.permissionSlugs,
    );
  }

  @Post('revoke-from-role')
  @Roles(UserRole.SUPER_ADMIN)
  @RequirePermissions('permissions.manage')
  @ApiOperation({
    summary: 'Revoke permissions from a role (SUPER_ADMIN only)',
  })
  revokeFromRole(@Body() dto: AssignPermissionsToRoleDto, @Request() req: any) {
    return this.roleManagement.revokePermissionsFromRole(
      dto.roleName,
      dto.permissionSlugs,
    );
  }
}
