import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SupportTicket } from '../entities/support-ticket.entity';
import { InstitutionalClient } from '../entities/institutional-client.entity';
import { CreateSupportTicketDto } from '../dto/create-support-ticket.dto';
import { SupportTicketFilterDto } from '../dto/support-ticket-filter.dto';
import {
  TICKET_SLA_RESPONSE_MINUTES,
  TICKET_SLA_RESOLUTION_MINUTES,
  SlaTier,
  TicketPriority,
} from '../enums/institutional.enums';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * Dedicated support ticket service for institutional clients.
 *
 * Features:
 *  - Priority-based SLA tracking (response + resolution deadlines)
 *  - Automatic account manager assignment
 *  - Escalation on SLA breach
 *  - Full audit trail
 */
@Injectable()
export class SupportTicketService {
  private readonly logger = new Logger(SupportTicketService.name);

  private ticketCounter = 0;

  constructor(
    @InjectRepository(SupportTicket)
    private readonly ticketRepo: Repository<SupportTicket>,
    @InjectRepository(InstitutionalClient)
    private readonly clientRepo: Repository<InstitutionalClient>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create a new institutional support ticket with SLA deadlines.
   */
  async createTicket(
    institutionalClientId: string,
    createdById: number,
    dto: CreateSupportTicketDto,
  ): Promise<SupportTicket> {
    const client = await this.clientRepo.findOne({
      where: { id: institutionalClientId },
    });
    if (!client) {
      throw new NotFoundException(
        `Institutional client ${institutionalClientId} not found`,
      );
    }

    const priority = dto.priority ?? 'HIGH';
    const tier = client.slaTier as SlaTier;

    // Calculate SLA deadlines
    const now = new Date();
    const responseMinutes =
      TICKET_SLA_RESPONSE_MINUTES[priority as TicketPriority]?.[tier] ?? 30;
    const resolutionMinutes =
      TICKET_SLA_RESOLUTION_MINUTES[priority as TicketPriority]?.[tier] ?? 480;

    const slaResponseDeadline = new Date(now.getTime() + responseMinutes * 60 * 1000);
    const slaResolutionDeadline = new Date(now.getTime() + resolutionMinutes * 60 * 1000);

    // Generate ticket number
    this.ticketCounter++;
    const ticketNumber = `INST-${Date.now().toString(36).toUpperCase()}-${this.ticketCounter
      .toString()
      .padStart(4, '0')}`;

    const ticket = this.ticketRepo.create({
      ticketNumber,
      institutionalClientId,
      createdById,
      subject: dto.subject,
      description: dto.description,
      category: dto.category ?? 'GENERAL',
      priority,
      status: 'OPEN',
      assignedToId: dto.assignedToId ?? undefined,
      accountManagerId: client.accountManagerId ?? undefined,
      slaResponseDeadline,
      slaResolutionDeadline,
    });

    const saved = await this.ticketRepo.save(ticket);

    // Emit event for notification
    this.eventEmitter.emit('institutional.ticket.created', {
      ticketId: saved.id,
      ticketNumber: saved.ticketNumber,
      institutionalClientId,
      priority,
      subject: saved.subject,
      assignedToId: saved.assignedToId,
      accountManagerId: saved.accountManagerId,
      slaResponseDeadline,
      timestamp: now,
    });

    this.logger.log(
      `Support ticket created: ${ticketNumber} for client ${institutionalClientId} ` +
      `(priority: ${priority}, SLA response by: ${slaResponseDeadline.toISOString()})`,
    );

    return saved;
  }

  /**
   * Update the status of a support ticket.
   */
  async updateTicketStatus(
    ticketId: string,
    status: string,
    updatedById: number,
    internalNotes?: string,
  ): Promise<SupportTicket> {
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
    if (!ticket) {
      throw new NotFoundException(`Support ticket ${ticketId} not found`);
    }

    const now = new Date();
    ticket.status = status as any;

    // Track SLA response (first status change from OPEN)
    if (ticket.status !== 'OPEN' && ticket.slaResponseMet === undefined) {
      ticket.slaResponseMet = ticket.slaResponseDeadline
        ? now <= ticket.slaResponseDeadline
        : true;
    }

    // Track resolution
    if (status === 'RESOLVED' || status === 'CLOSED') {
      ticket.resolvedAt = now;
      if (ticket.slaResolutionMet === undefined) {
        ticket.slaResolutionMet = ticket.slaResolutionDeadline
          ? now <= ticket.slaResolutionDeadline
          : true;
      }
    }
    if (status === 'CLOSED') {
      ticket.closedAt = now;
    }

    if (internalNotes) {
      ticket.internalNotes = internalNotes;
    }

    const saved = await this.ticketRepo.save(ticket);

    this.eventEmitter.emit('institutional.ticket.updated', {
      ticketId: saved.id,
      ticketNumber: saved.ticketNumber,
      status: saved.status,
      updatedById,
      timestamp: now,
    });

    return saved;
  }

  /**
   * Assign a ticket to a support staff member.
   */
  async assignTicket(
    ticketId: string,
    assignedToId: number,
  ): Promise<SupportTicket> {
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
    if (!ticket) {
      throw new NotFoundException(`Support ticket ${ticketId} not found`);
    }

    ticket.assignedToId = assignedToId;
    if (ticket.status === 'OPEN') {
      ticket.status = 'IN_PROGRESS';
    }

    return this.ticketRepo.save(ticket);
  }

  /**
   * Escalate a ticket (e.g., on SLA breach).
   */
  async escalateTicket(
    ticketId: string,
    reason: string,
  ): Promise<SupportTicket> {
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
    if (!ticket) {
      throw new NotFoundException(`Support ticket ${ticketId} not found`);
    }

    ticket.status = 'ESCALATED';
    ticket.priority = this.escalatePriority(ticket.priority);
    ticket.internalNotes = ticket.internalNotes
      ? `${ticket.internalNotes}\n\n[ESCALATION] ${reason}`
      : `[ESCALATION] ${reason}`;

    const saved = await this.ticketRepo.save(ticket);

    this.eventEmitter.emit('institutional.ticket.escalated', {
      ticketId: saved.id,
      ticketNumber: saved.ticketNumber,
      newPriority: saved.priority,
      reason,
      timestamp: new Date(),
    });

    this.logger.warn(
      `Support ticket ${ticket.ticketNumber} escalated to ${saved.priority}: ${reason}`,
    );

    return saved;
  }

  /**
   * Get tickets for an institutional client with optional filters.
   */
  async getTickets(
    institutionalClientId: string,
    filters?: SupportTicketFilterDto,
  ): Promise<{ tickets: SupportTicket[]; total: number }> {
    const qb = this.ticketRepo
      .createQueryBuilder('ticket')
      .where('ticket.institutionalClientId = :institutionalClientId', {
        institutionalClientId,
      });

    if (filters?.status) {
      qb.andWhere('ticket.status = :status', { status: filters.status });
    }
    if (filters?.priority) {
      qb.andWhere('ticket.priority = :priority', { priority: filters.priority });
    }
    if (filters?.category) {
      qb.andWhere('ticket.category = :category', { category: filters.category });
    }
    if (filters?.assignedToId) {
      qb.andWhere('ticket.assignedToId = :assignedToId', {
        assignedToId: filters.assignedToId,
      });
    }

    qb.orderBy('ticket.createdAt', 'DESC');

    const limit = filters?.limit ?? 20;
    const offset = filters?.offset ?? 0;
    qb.skip(offset).take(limit);

    const [tickets, total] = await qb.getManyAndCount();
    return { tickets, total };
  }

  /**
   * Get a specific ticket by ID.
   */
  async getTicketById(ticketId: string): Promise<SupportTicket> {
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
    if (!ticket) {
      throw new NotFoundException(`Support ticket ${ticketId} not found`);
    }
    return ticket;
  }

  /**
   * Check for tickets that have breached their SLA deadlines.
   * Intended for periodic cron execution.
   */
  async checkSlaBreaches(): Promise<SupportTicket[]> {
    const now = new Date();

    // Find tickets with breached response SLA (still OPEN or IN_PROGRESS)
    const responseBreaches = await this.ticketRepo
      .createQueryBuilder('ticket')
      .where('ticket.slaResponseDeadline < :now', { now })
      .andWhere('ticket.slaResponseMet IS NULL')
      .andWhere('ticket.status IN (:...statuses)', {
        statuses: ['OPEN', 'IN_PROGRESS'],
      })
      .getMany();

    const breached: SupportTicket[] = [];

    for (const ticket of responseBreaches) {
      ticket.slaResponseMet = false;
      await this.ticketRepo.save(ticket);

      await this.escalateTicket(
        ticket.id,
        `SLA response deadline breached. Deadline was ${ticket.slaResponseDeadline}`,
      );

      breached.push(ticket);
    }

    // Find tickets with breached resolution SLA
    const resolutionBreaches = await this.ticketRepo
      .createQueryBuilder('ticket')
      .where('ticket.slaResolutionDeadline < :now', { now })
      .andWhere('ticket.slaResolutionMet IS NULL')
      .andWhere('ticket.status NOT IN (:...resolved)', {
        resolved: ['RESOLVED', 'CLOSED'],
      })
      .getMany();

    for (const ticket of resolutionBreaches) {
      ticket.slaResolutionMet = false;
      await this.ticketRepo.save(ticket);

      await this.escalateTicket(
        ticket.id,
        `SLA resolution deadline breached. Deadline was ${ticket.slaResolutionDeadline}`,
      );

      breached.push(ticket);
    }

    if (breached.length > 0) {
      this.logger.warn(
        `SLA breach check: ${breached.length} tickets have breached SLA deadlines`,
      );
    }

    return breached;
  }

  /**
   * Get SLA compliance statistics for institutional support tickets.
   */
  async getSlaComplianceStats(
    institutionalClientId?: string,
  ): Promise<{
    totalTickets: number;
    slaResponseMetCount: number;
    slaResolutionMetCount: number;
    slaResponseCompliancePercent: number;
    slaResolutionCompliancePercent: number;
    averageResponseTimeMinutes: number;
    averageResolutionTimeMinutes: number;
    openTickets: number;
    escalatedTickets: number;
  }> {
    const qb = this.ticketRepo.createQueryBuilder('ticket');

    if (institutionalClientId) {
      qb.where('ticket.institutionalClientId = :id', { id: institutionalClientId });
    }

    const tickets = await qb.getMany();

    const closedTickets = tickets.filter(
      (t) => t.slaResponseMet !== undefined && t.slaResponseMet !== null,
    );

    const responseMetCount = closedTickets.filter((t) => t.slaResponseMet === true).length;
    const resolutionMetCount = tickets.filter((t) => t.slaResolutionMet === true).length;

    const resolvedTickets = tickets.filter((t) => t.resolvedAt);

    return {
      totalTickets: tickets.length,
      slaResponseMetCount: responseMetCount,
      slaResolutionMetCount: resolutionMetCount,
      slaResponseCompliancePercent:
        closedTickets.length > 0
          ? Math.round((responseMetCount / closedTickets.length) * 100 * 100) / 100
          : 100,
      slaResolutionCompliancePercent:
        resolvedTickets.length > 0
          ? Math.round((resolutionMetCount / resolvedTickets.length) * 100 * 100) / 100
          : 100,
      averageResponseTimeMinutes: 0, // Would need timestamps for calculation
      averageResolutionTimeMinutes: 0,
      openTickets: tickets.filter((t) => ['OPEN', 'IN_PROGRESS', 'ESCALATED'].includes(t.status)).length,
      escalatedTickets: tickets.filter((t) => t.status === 'ESCALATED').length,
    };
  }

  /**
   * Escalate priority level.
   */
  private escalatePriority(current: string): any {
    const priorityMap: Record<string, string> = {
      LOW: 'MEDIUM',
      MEDIUM: 'HIGH',
      HIGH: 'CRITICAL',
      CRITICAL: 'CRITICAL',
    };
    return priorityMap[current] ?? current;
  }
}
