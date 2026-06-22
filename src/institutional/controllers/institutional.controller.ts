import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RbacGuard } from '../../identity/roles/guards/rbac.guard';
import { Roles } from '../../identity/roles/decorators/roles.decorator';
import { UserRole } from '../../identity/roles/enums/user-role.enum';
import type { JwtPayload } from '../../auth/guards/jwt-auth.guard';

import { InstitutionalClientService } from '../services/institutional-client.service';
import { BulkTradeService } from '../services/bulk-trade.service';
import { ReconciliationService } from '../services/reconciliation.service';
import { SlaMonitoringService } from '../services/sla-monitoring.service';
import { SupportTicketService } from '../services/support-ticket.service';

import { CreateInstitutionalClientDto } from '../dto/create-institutional-client.dto';
import { BulkTradeDto } from '../dto/bulk-trade.dto';
import { GenerateReconciliationReportDto, ReconciliationReportFilterDto } from '../dto/reconciliation-report.dto';
import { CreateSupportTicketDto } from '../dto/create-support-ticket.dto';
import { SupportTicketFilterDto } from '../dto/support-ticket-filter.dto';

/**
 * Institutional Portal Controller
 *
 * Provides dedicated endpoints for institutional clients including:
 *  - Client profile management
 *  - Bulk trading APIs (1000+ trades/sec)
 *  - Custom reporting and reconciliation
 *  - SLA monitoring and compliance
 *  - Dedicated support ticket system
 */
@ApiTags('Institutional Portal')
@Controller('institutional')
@UseGuards(JwtAuthGuard, RbacGuard)
@ApiBearerAuth()
export class InstitutionalController {
  private readonly logger = new Logger(InstitutionalController.name);

  constructor(
    private readonly clientService: InstitutionalClientService,
    private readonly bulkTradeService: BulkTradeService,
    private readonly reconciliationService: ReconciliationService,
    private readonly slaMonitoringService: SlaMonitoringService,
    private readonly supportTicketService: SupportTicketService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // CLIENT PROFILE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('clients')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Register a new institutional client' })
  @ApiResponse({ status: 201, description: 'Institutional client created' })
  @ApiResponse({ status: 409, description: 'Client already exists for this user' })
  async createClient(@Body() dto: CreateInstitutionalClientDto) {
    return this.clientService.create(dto);
  }

  @Get('clients')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.COMPLIANCE_OFFICER)
  @ApiOperation({ summary: 'List all institutional clients' })
  @ApiResponse({ status: 200, description: 'List of institutional clients' })
  async listClients(
    @Query('slaTier') slaTier?: string,
    @Query('isActive') isActive?: string,
    @Query('accountManagerId') accountManagerId?: string,
  ) {
    return this.clientService.findAll({
      slaTier,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      accountManagerId: accountManagerId ? parseInt(accountManagerId) : undefined,
    });
  }

  @Get('clients/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.COMPLIANCE_OFFICER, UserRole.INSTITUTIONAL_CLIENT)
  @ApiOperation({ summary: 'Get institutional client details' })
  @ApiResponse({ status: 200, description: 'Institutional client details' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  async getClient(@Param('id') id: string) {
    return this.clientService.findById(id);
  }

  @Put('clients/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update institutional client configuration' })
  @ApiResponse({ status: 200, description: 'Client updated' })
  async updateClient(
    @Param('id') id: string,
    @Body() dto: Partial<CreateInstitutionalClientDto>,
  ) {
    return this.clientService.update(id, dto);
  }

  @Patch('clients/:id/deactivate')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate an institutional client' })
  async deactivateClient(@Param('id') id: string) {
    return this.clientService.deactivate(id);
  }

  @Patch('clients/:id/activate')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate an institutional client' })
  async activateClient(@Param('id') id: string) {
    return this.clientService.activate(id);
  }

  @Get('my-profile')
  @Roles(UserRole.INSTITUTIONAL_CLIENT)
  @ApiOperation({ summary: 'Get your institutional client profile' })
  @ApiResponse({ status: 200, description: 'Institutional client profile' })
  async getMyProfile(@Req() req: { user: JwtPayload }) {
    const userId = parseInt(req.user.userId, 10);
    return this.clientService.findByUserId(userId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BULK TRADING
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('trades/bulk')
  @Roles(UserRole.INSTITUTIONAL_CLIENT)
  @ApiOperation({
    summary: 'Submit bulk trades (supports 1000+ trades/sec)',
    description:
      'Submit a batch of up to 500 trades in a single request. ' +
      'Supports atomic (all-or-nothing) and non-atomic execution modes. ' +
      'Institutional clients can achieve 1000+ trades/second throughput.',
  })
  @ApiResponse({ status: 201, description: 'Bulk trade execution results' })
  @ApiResponse({ status: 400, description: 'Invalid trade data or exceeded limits' })
  async executeBulkTrades(
    @Body() dto: BulkTradeDto,
    @Req() req: { user: JwtPayload },
  ) {
    const userId = parseInt(req.user.userId, 10);
    this.logger.log(
      `Bulk trade request from user ${userId}: ${dto.trades.length} trades (atomic: ${dto.atomic ?? false})`,
    );
    return this.bulkTradeService.executeBulkTrades(
      userId,
      dto.trades,
      dto.atomic ?? false,
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RECONCILIATION REPORTS
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('reports/reconciliation')
  @Roles(UserRole.INSTITUTIONAL_CLIENT, UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER)
  @ApiOperation({ summary: 'Generate a reconciliation report' })
  @ApiResponse({ status: 201, description: 'Reconciliation report generated' })
  async generateReconciliationReport(@Body() dto: GenerateReconciliationReportDto) {
    return this.reconciliationService.generateReport(dto);
  }

  @Get('reports/reconciliation')
  @Roles(UserRole.INSTITUTIONAL_CLIENT, UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER)
  @ApiOperation({ summary: 'Get reconciliation reports' })
  @ApiResponse({ status: 200, description: 'List of reconciliation reports' })
  async getReconciliationReports(
    @Query('institutionalClientId') institutionalClientId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
    @Query('reportType') reportType?: string,
  ) {
    return this.reconciliationService.getReports(institutionalClientId, {
      startDate,
      endDate,
      status,
      reportType,
    });
  }

  @Get('reports/reconciliation/:id')
  @Roles(UserRole.INSTITUTIONAL_CLIENT, UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER)
  @ApiOperation({ summary: 'Get a specific reconciliation report' })
  @ApiResponse({ status: 200, description: 'Reconciliation report details' })
  @ApiResponse({ status: 404, description: 'Report not found' })
  async getReconciliationReport(@Param('id') id: string) {
    return this.reconciliationService.getReportById(id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SLA MONITORING
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('sla/policies')
  @Roles(UserRole.INSTITUTIONAL_CLIENT, UserRole.ADMIN, UserRole.SUPPORT_AGENT)
  @ApiOperation({ summary: 'Get SLA policies for an institutional client' })
  @ApiResponse({ status: 200, description: 'SLA policies' })
  async getSlaPolicies(@Query('institutionalClientId') institutionalClientId: string) {
    return this.slaMonitoringService.getSlaPolicies(institutionalClientId);
  }

  @Get('sla/compliance')
  @Roles(UserRole.INSTITUTIONAL_CLIENT, UserRole.ADMIN, UserRole.SUPPORT_AGENT, UserRole.COMPLIANCE_OFFICER)
  @ApiOperation({ summary: 'Get SLA compliance summary' })
  @ApiResponse({ status: 200, description: 'SLA compliance summary' })
  async getSlaCompliance(@Query('institutionalClientId') institutionalClientId: string) {
    return this.slaMonitoringService.getSlaComplianceSummary(institutionalClientId);
  }

  @Get('sla/violations')
  @Roles(UserRole.INSTITUTIONAL_CLIENT, UserRole.ADMIN, UserRole.SUPPORT_AGENT)
  @ApiOperation({ summary: 'Get SLA violations' })
  @ApiResponse({ status: 200, description: 'SLA violations' })
  async getSlaViolations(
    @Query('institutionalClientId') institutionalClientId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.slaMonitoringService.getAllViolations(
      institutionalClientId,
      limit ? parseInt(limit) : 50,
      offset ? parseInt(offset) : 0,
    );
  }

  @Patch('sla/violations/:id/resolve')
  @Roles(UserRole.ADMIN, UserRole.SUPPORT_AGENT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resolve an SLA violation' })
  @ApiResponse({ status: 200, description: 'Violation resolved' })
  async resolveSlaViolation(
    @Param('id') id: string,
    @Body() body: { resolvedBy: string; notes?: string },
  ) {
    return this.slaMonitoringService.resolveViolation(id, body.resolvedBy, body.notes);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUPPORT TICKETS
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('support/tickets')
  @Roles(UserRole.INSTITUTIONAL_CLIENT)
  @ApiOperation({ summary: 'Create a support ticket (institutional priority)' })
  @ApiResponse({ status: 201, description: 'Support ticket created with SLA deadlines' })
  async createSupportTicket(
    @Body() dto: CreateSupportTicketDto,
    @Req() req: { user: JwtPayload },
  ) {
    const userId = parseInt(req.user.userId, 10);
    const client = await this.clientService.findByUserId(userId);
    return this.supportTicketService.createTicket(client.id, userId, dto);
  }

  @Get('support/tickets')
  @Roles(UserRole.INSTITUTIONAL_CLIENT, UserRole.ADMIN, UserRole.SUPPORT_AGENT)
  @ApiOperation({ summary: 'Get institutional support tickets' })
  @ApiResponse({ status: 200, description: 'List of support tickets' })
  async getSupportTickets(
    @Query('institutionalClientId') institutionalClientId: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('category') category?: string,
    @Query('assignedToId') assignedToId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.supportTicketService.getTickets(institutionalClientId, {
      status,
      priority,
      category,
      assignedToId: assignedToId ? parseInt(assignedToId) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  @Get('support/tickets/:id')
  @Roles(UserRole.INSTITUTIONAL_CLIENT, UserRole.ADMIN, UserRole.SUPPORT_AGENT)
  @ApiOperation({ summary: 'Get a specific support ticket' })
  @ApiResponse({ status: 200, description: 'Support ticket details' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async getSupportTicket(@Param('id') id: string) {
    return this.supportTicketService.getTicketById(id);
  }

  @Patch('support/tickets/:id/status')
  @Roles(UserRole.INSTITUTIONAL_CLIENT, UserRole.ADMIN, UserRole.SUPPORT_AGENT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update support ticket status' })
  @ApiResponse({ status: 200, description: 'Ticket status updated' })
  async updateTicketStatus(
    @Param('id') id: string,
    @Body() body: { status: string; internalNotes?: string },
    @Req() req: { user: JwtPayload },
  ) {
    const updatedById = parseInt(req.user.userId, 10);
    return this.supportTicketService.updateTicketStatus(
      id,
      body.status,
      updatedById,
      body.internalNotes,
    );
  }

  @Patch('support/tickets/:id/assign')
  @Roles(UserRole.ADMIN, UserRole.SUPPORT_AGENT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign a support ticket' })
  @ApiResponse({ status: 200, description: 'Ticket assigned' })
  async assignTicket(
    @Param('id') id: string,
    @Body() body: { assignedToId: number },
  ) {
    return this.supportTicketService.assignTicket(id, body.assignedToId);
  }

  @Patch('support/tickets/:id/escalate')
  @Roles(UserRole.ADMIN, UserRole.SUPPORT_AGENT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Escalate a support ticket' })
  @ApiResponse({ status: 200, description: 'Ticket escalated' })
  async escalateTicket(
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    return this.supportTicketService.escalateTicket(id, body.reason);
  }

  @Get('support/sla-stats')
  @Roles(UserRole.ADMIN, UserRole.SUPPORT_AGENT, UserRole.COMPLIANCE_OFFICER)
  @ApiOperation({ summary: 'Get support ticket SLA compliance statistics' })
  @ApiResponse({ status: 200, description: 'SLA compliance statistics' })
  async getSupportSlaStats(
    @Query('institutionalClientId') institutionalClientId?: string,
  ) {
    return this.supportTicketService.getSlaComplianceStats(institutionalClientId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PORTAL DASHBOARD
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('dashboard')
  @Roles(UserRole.INSTITUTIONAL_CLIENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get institutional portal dashboard overview' })
  @ApiResponse({ status: 200, description: 'Dashboard data' })
  async getDashboard(@Req() req: { user: JwtPayload }) {
    const userId = parseInt(req.user.userId, 10);

    try {
      const client = await this.clientService.findByUserId(userId);

      const [slaSummary, ticketStats, recentReports, activeViolations] =
        await Promise.all([
          this.slaMonitoringService.getSlaComplianceSummary(client.id),
          this.supportTicketService.getSlaComplianceStats(client.id),
          this.reconciliationService.getReports(client.id, {}),
          this.slaMonitoringService.getActiveViolations(client.id),
        ]);

      return {
        client: {
          id: client.id,
          companyName: client.companyName,
          slaTier: client.slaTier,
          accountManagerId: client.accountManagerId,
          maxTradesPerSecond: client.maxTradesPerSecond,
        },
        sla: slaSummary,
        tickets: ticketStats,
        recentReports: recentReports.slice(0, 5),
        activeViolations: activeViolations.length,
      };
    } catch {
      return {
        client: null,
        message: 'No institutional client profile found. Contact support to onboard.',
      };
    }
  }
}
