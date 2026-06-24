import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
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
import { RoleManagementService } from '../services/role-management.service';
import { CreateRoleDto } from '../dto/create-role.dto';
import { AssignRoleDto, RevokeRoleDto } from '../dto/assign-role.dto';
import { Roles } from '../decorators/roles.decorator';
import { RequirePermissions } from '../../permissions/decorators/require-permissions.decorator';
import { RbacGuard } from '../guards/rbac.guard';
import { UserRole } from '../enums/user-role.enum';

@ApiTags('Identity / Roles')
@ApiBearerAuth()
@UseGuards(RbacGuard)
@Controller('identity/roles')
export class RolesController {
  constructor(private readonly roleManagement: RoleManagementService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.COMPLIANCE_OFFICER)
  @ApiOperation({ summary: 'List all roles' })
  @ApiResponse({ status: 200, description: 'All platform roles' })
  findAll() {
    return this.roleManagement.findAll();
  }

  @Get(':name')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get a specific role by name' })
  @ApiParam({ name: 'name', enum: UserRole })
  findOne(@Param('name') name: UserRole) {
    return this.roleManagement.findOne(name);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  @RequirePermissions('roles.manage')
  @ApiOperation({ summary: 'Create a new role (SUPER_ADMIN only)' })
  create(@Body() dto: CreateRoleDto) {
    return this.roleManagement.create(dto);
  }

  @Post('assign')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @RequirePermissions('roles.assign')
  @ApiOperation({ summary: 'Assign roles to a user' })
  assignRoles(@Body() dto: AssignRoleDto, @Request() req: any) {
    return this.roleManagement.assignRolesToUser(dto, String(req.user?.id));
  }

  @Post('revoke')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @RequirePermissions('roles.revoke')
  @ApiOperation({ summary: 'Revoke roles from a user' })
  revokeRoles(@Body() dto: RevokeRoleDto, @Request() req: any) {
    return this.roleManagement.revokeRolesFromUser(dto, String(req.user?.id));
  }

  @Get('user/:userId')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SUPPORT_AGENT)
  @RequirePermissions('roles.read')
  @ApiOperation({ summary: 'Get all roles and permissions for a user' })
  @ApiParam({ name: 'userId', type: String })
  getUserRoles(@Param('userId') userId: string) {
    return this.roleManagement.getUserRoles(userId);
  }
}
