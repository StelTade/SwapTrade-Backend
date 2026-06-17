import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
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
import { Throttle } from '@nestjs/throttler';
import { IdentityAdminService } from '../services/identity-admin.service';
import { SuspendUserDto, ActivateUserDto } from '../dto/suspend-user.dto';
import { UserQueryDto } from '../dto/user-query.dto';
import { Roles } from '../../roles/decorators/roles.decorator';
import { RequirePermissions } from '../../permissions/decorators/require-permissions.decorator';
import { RbacGuard } from '../../roles/guards/rbac.guard';
import { UserRole } from '../../roles/enums/user-role.enum';

@ApiTags('Identity / Admin')
@ApiBearerAuth()
@UseGuards(RbacGuard)
@Throttle({ default: { limit: 30, ttl: 60_000 } })
@Controller('identity/admin')
export class IdentityAdminController {
  constructor(private readonly adminService: IdentityAdminService) {}

  // ─── Dashboard ─────────────────────────────────────────────────────────────

  @Get('dashboard/stats')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.COMPLIANCE_OFFICER)
  @RequirePermissions('admin.access')
  @ApiOperation({ summary: 'Get admin dashboard statistics' })
  @ApiResponse({ status: 200 })
  getDashboardStats() {
    return this.adminService.getAdminDashboardStats();
  }

  // ─── User Management ───────────────────────────────────────────────────────

  @Get('users')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SUPPORT_AGENT, UserRole.COMPLIANCE_OFFICER)
  @RequirePermissions('users.read')
  @ApiOperation({ summary: 'List users with filters and pagination' })
  listUsers(@Query() query: UserQueryDto) {
    return this.adminService.listUsers(query);
  }

  @Get('users/:userId')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SUPPORT_AGENT, UserRole.COMPLIANCE_OFFICER)
  @RequirePermissions('users.read')
  @ApiOperation({ summary: 'Get a specific user by ID' })
  @ApiParam({ name: 'userId', type: Number })
  getUser(@Param('userId', ParseIntPipe) userId: number) {
    return this.adminService.getUser(userId);
  }

  // ─── Account Suspension & Activation ──────────────────────────────────────

  @Post('users/suspend')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.COMPLIANCE_OFFICER)
  @RequirePermissions('accounts.suspend')
  @ApiOperation({ summary: 'Suspend a user account' })
  @ApiResponse({ status: 200, description: 'User suspended' })
  suspendUser(@Body() dto: SuspendUserDto, @Request() req: any) {
    return this.adminService.suspendUser(dto, String(req.user?.id));
  }

  @Post('users/activate')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SUPPORT_AGENT)
  @RequirePermissions('accounts.manage')
  @ApiOperation({ summary: 'Activate (unsuspend) a user account' })
  @ApiResponse({ status: 200, description: 'User activated' })
  activateUser(@Body() dto: ActivateUserDto, @Request() req: any) {
    return this.adminService.activateUser(dto, String(req.user?.id));
  }
}
