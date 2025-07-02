
import { Controller, Get, Patch, Param, UseGuards, Body } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AuthGuardGuard } from '../auth/guard/auth-guard/auth-guard.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('admin')
@UseGuards(AuthGuardGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  getUsers() {
    return this.adminService.getUsers();
  }

  @Patch('users/:id/ban')
  banUser(@Param('id') id: string) {
    return this.adminService.banUser(id);
  }

  @Patch('users/:id/activate')
  activateUser(@Param('id') id: string) {
    return this.adminService.activateUser(id);
  }

  @Patch('users/:id/deactivate')
  deactivateUser(@Param('id') id: string) {
    return this.adminService.deactivateUser(id);
  }

  @Get('assets')
  getAssets() {
    return this.adminService.getAssets();
  }

  @Get('offers')
  getOffers() {
    return this.adminService.getOffers();
  }

  @Get('metrics')
  getMetrics() {
    return this.adminService.getMetrics();
  }
}
