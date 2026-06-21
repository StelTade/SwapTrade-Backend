import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InstitutionalClient } from '../entities/institutional-client.entity';
import { SlaPolicy } from '../entities/sla-policy.entity';
import { CreateInstitutionalClientDto } from '../dto/create-institutional-client.dto';
import {
  SlaTier,
  SlaMetricType,
  DEFAULT_SLA_TARGETS,
} from '../enums/institutional.enums';

/**
 * Manages institutional client profiles, SLA setup, and quota configuration.
 */
@Injectable()
export class InstitutionalClientService {
  private readonly logger = new Logger(InstitutionalClientService.name);

  constructor(
    @InjectRepository(InstitutionalClient)
    private readonly clientRepo: Repository<InstitutionalClient>,
    @InjectRepository(SlaPolicy)
    private readonly slaRepo: Repository<SlaPolicy>,
  ) {}

  /**
   * Register a new institutional client and set up default SLA policies.
   */
  async create(dto: CreateInstitutionalClientDto): Promise<InstitutionalClient> {
    // Check for duplicate
    const existing = await this.clientRepo.findOne({
      where: { userId: dto.userId },
    });
    if (existing) {
      throw new ConflictException(
        `Institutional client profile already exists for user ${dto.userId}`,
      );
    }

    const client = this.clientRepo.create({
      userId: dto.userId,
      companyName: dto.companyName,
      lei: dto.lei,
      taxId: dto.taxId,
      jurisdiction: dto.jurisdiction,
      accountManagerId: dto.accountManagerId,
      slaTier: dto.slaTier ?? 'GOLD',
      maxTradesPerSecond: dto.maxTradesPerSecond ?? 1000,
      maxApiRequestsPerSecond: dto.maxApiRequestsPerSecond ?? 5000,
      dailyVolumeLimit: dto.dailyVolumeLimit ?? 0,
      ipWhitelist: dto.ipWhitelist,
      webhookUrl: dto.webhookUrl,
      metadata: dto.metadata,
    });

    const saved = await this.clientRepo.save(client);

    // Create default SLA policies for the tier
    await this.createDefaultSlaPolicies(saved);

    this.logger.log(
      `Institutional client created: ${saved.id} (user: ${dto.userId}, tier: ${saved.slaTier})`,
    );

    return saved;
  }

  /**
   * Find an institutional client by their user ID.
   */
  async findByUserId(userId: number): Promise<InstitutionalClient> {
    const client = await this.clientRepo.findOne({ where: { userId } });
    if (!client) {
      throw new NotFoundException(
        `No institutional client profile found for user ${userId}`,
      );
    }
    return client;
  }

  /**
   * Find an institutional client by their institutional client ID.
   */
  async findById(id: string): Promise<InstitutionalClient> {
    const client = await this.clientRepo.findOne({ where: { id } });
    if (!client) {
      throw new NotFoundException(`Institutional client ${id} not found`);
    }
    return client;
  }

  /**
   * List all institutional clients with optional filters.
   */
  async findAll(filters?: {
    slaTier?: string;
    isActive?: boolean;
    accountManagerId?: number;
  }): Promise<InstitutionalClient[]> {
    const where: any = {};
    if (filters?.slaTier) where.slaTier = filters.slaTier;
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;
    if (filters?.accountManagerId) where.accountManagerId = filters.accountManagerId;

    return this.clientRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Update institutional client configuration.
   */
  async update(
    id: string,
    updates: Partial<CreateInstitutionalClientDto>,
  ): Promise<InstitutionalClient> {
    const client = await this.findById(id);

    if (updates.companyName !== undefined) client.companyName = updates.companyName;
    if (updates.lei !== undefined) client.lei = updates.lei;
    if (updates.taxId !== undefined) client.taxId = updates.taxId;
    if (updates.jurisdiction !== undefined) client.jurisdiction = updates.jurisdiction;
    if (updates.accountManagerId !== undefined) client.accountManagerId = updates.accountManagerId;
    if (updates.maxTradesPerSecond !== undefined) client.maxTradesPerSecond = updates.maxTradesPerSecond;
    if (updates.maxApiRequestsPerSecond !== undefined) client.maxApiRequestsPerSecond = updates.maxApiRequestsPerSecond;
    if (updates.dailyVolumeLimit !== undefined) client.dailyVolumeLimit = updates.dailyVolumeLimit;
    if (updates.ipWhitelist !== undefined) client.ipWhitelist = updates.ipWhitelist;
    if (updates.webhookUrl !== undefined) client.webhookUrl = updates.webhookUrl;
    if (updates.metadata !== undefined) client.metadata = updates.metadata;

    // If SLA tier changed, recreate default policies
    if (updates.slaTier && updates.slaTier !== client.slaTier) {
      client.slaTier = updates.slaTier;
      await this.slaRepo.delete({ institutionalClientId: id });
      await this.createDefaultSlaPolicies(client);
    }

    return this.clientRepo.save(client);
  }

  /**
   * Deactivate an institutional client.
   */
  async deactivate(id: string): Promise<InstitutionalClient> {
    const client = await this.findById(id);
    client.isActive = false;
    return this.clientRepo.save(client);
  }

  /**
   * Activate an institutional client.
   */
  async activate(id: string): Promise<InstitutionalClient> {
    const client = await this.findById(id);
    client.isActive = true;
    return this.clientRepo.save(client);
  }

  /**
   * Create default SLA policies based on the client's SLA tier.
   */
  private async createDefaultSlaPolicies(client: InstitutionalClient): Promise<void> {
    const tier = client.slaTier as SlaTier;
    const targets = DEFAULT_SLA_TARGETS[tier];
    if (!targets) return;

    const policies: SlaPolicy[] = [];

    for (const [metricType, config] of Object.entries(targets)) {
      const policy = this.slaRepo.create({
        institutionalClientId: client.id,
        metricType: metricType as SlaMetricType,
        targetValue: config.target,
        unit: config.unit as any,
        warningThreshold: config.warning,
        criticalThreshold: config.critical,
        isActive: true,
      });
      policies.push(policy);
    }

    await this.slaRepo.save(policies);
    this.logger.log(
      `Created ${policies.length} default SLA policies for client ${client.id} (tier: ${tier})`,
    );
  }
}
