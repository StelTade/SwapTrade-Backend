import { Controller, Get, Query, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuditLoggerService } from '../logging/audit-logger.service';

@ApiTags('audit')
@Controller('audit')
@ApiBearerAuth()
export class AuditController {
  constructor(private readonly auditService: AuditLoggerService) {}

  @Get('verify')
  @ApiOperation({ summary: 'Verify audit log integrity' })
  async verifyIntegrity() {
    return this.auditService.verifyIntegrity();
  }

  @Get('report/:type')
  @ApiOperation({ summary: 'Generate compliance report (SOC2, GDPR, AML)' })
  async generateReport(
    @Param('type') type: 'SOC2' | 'GDPR' | 'AML',
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.auditService.generateReport(
      type,
      new Date(startDate),
      new Date(endDate),
    );
  }
}