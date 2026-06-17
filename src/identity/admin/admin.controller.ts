import {
  Controller,
  Post,
  Delete,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Get,
} from '@nestjs/common';
import { PermissionsGuard } from '../permissions/guards/permissions.guard';
import { RequirePermissions } from '../permissions/decorators/permissions.decorator';
import { RoleManagementService } from './services/role-management.service';
import { RoleAssignmentDto } from './dto/role-assignment.dto';
import { UserRole } from '../roles/enums/user-role.enum';

@Controller('admin/users')
@UseGuards(PermissionsGuard)
export class IdentityAdminController {
  constructor(private readonly roleManagementService: RoleManagementService) {}

  /**
   * Assign a role to a user
   * Requires users.write permission
   */
  @Post(':userId/roles')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('users.write')
  async assignRole(
    @Param('userId') userId: number,
    @Body() dto: RoleAssignmentDto,
    @Request() req: any,
  ) {
    return this.roleManagementService.assignRole(userId, dto, {
      id: req.user.id,
      roles: req.user.roles,
    });
  }

  /**
   * Revoke a role from a user
   * Requires users.write permission
   */
  @Delete(':userId/roles/:role')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('users.write')
  async revokeRole(
    @Param('userId') userId: number,
    @Param('role') role: UserRole,
    @Request() req: any,
  ) {
    return this.roleManagementService.revokeRole(userId, role, {
      id: req.user.id,
      roles: req.user.roles,
    });
  }

  /**
   * Get all roles assigned to a user
   * Requires users.read permission
   */
  @Get(':userId/roles')
  @RequirePermissions('users.read')
  async getUserRoles(@Param('userId') userId: number) {
    return this.roleManagementService.getUserRoles(userId);
  }

  /**
   * Suspend a user account
   * Requires users.write permission
   */
  @Patch(':userId/suspend')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('users.write')
  async suspendUser(
    @Param('userId') userId: number,
    @Body() body: { reason: string },
    @Request() req: any,
  ) {
    return this.roleManagementService.suspendUser(
      userId,
      { id: req.user.id, roles: req.user.roles },
      body.reason,
    );
  }

  /**
   * Activate a suspended user account
   * Requires users.write permission
   */
  @Patch(':userId/activate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('users.write')
  async activateUser(@Param('userId') userId: number, @Request() req: any) {
    return this.roleManagementService.activateUser(userId, {
      id: req.user.id,
      roles: req.user.roles,
    });
  }
}
