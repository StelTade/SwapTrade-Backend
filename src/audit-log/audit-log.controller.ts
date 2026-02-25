import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

@ApiTags('Admin / Audit')
@ApiBearerAuth()
@Controller('admin/audit')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get('user/:userId')
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  getUserLogs(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.auditLogService.getByUser(
      userId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  @Get('entity/:entityType/:entityId')
  getEntityLogs(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.auditLogService.getByEntity(entityType, entityId);
  }

  @Get('suspicious')
  @ApiQuery({ name: 'from', required: true })
  @ApiQuery({ name: 'to', required: true })
  getSuspicious(@Query('from') from: string, @Query('to') to: string) {
    return this.auditLogService.getSuspiciousActivity(
      new Date(from),
      new Date(to),
    );
  }

  @Get('integrity')
  verifyIntegrity() {
    return this.auditLogService.verifyChainIntegrity();
  }

  @Get('timeline/:userId')
  getUserTimeline(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.auditLogService.getUserTimeline(userId);
  }
}
