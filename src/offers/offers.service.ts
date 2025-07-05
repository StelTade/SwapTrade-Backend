import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Offer } from './entities/offer.entity';
import { CreateOfferDto } from './dto/create-offer.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { QueryOffersDto } from './dto/query-offers.dto';
import { OfferResponseDto } from './dto/offer-response.dto';
import { User } from '../user/user.entity';
import { Portfolio } from '../portfolio/entities/portfolio.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { OfferStatus } from './enums/offer-status.enum';
import { NotificationType } from '../notifications/enums/notification-type.enum';

@Injectable()
export class OffersService {
  private readonly logger = new Logger(OffersService.name);

  constructor(
    @InjectRepository(Offer)
    private readonly offerRepository: Repository<Offer>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Portfolio)
    private readonly portfolioRepository: Repository<Portfolio>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly dataSource: DataSource,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createOffer(createOfferDto: CreateOfferDto, initiatorId: number): Promise<OfferResponseDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Validate recipient exists
      const recipient = await this.userRepository.findOne({
        where: { id: createOfferDto.recipientId },
      });
      if (!recipient) {
        throw new NotFoundException('Recipient user not found');
      }

      // Validate initiator is not trying to trade with themselves
      if (initiatorId === createOfferDto.recipientId) {
        throw new BadRequestException('Cannot create offer to yourself');
      }

      // Validate offered asset ownership
      const offeredAsset = await this.portfolioRepository.findOne({
        where: { id: createOfferDto.offeredAssetId },
        relations: ['user'],
      });
      if (!offeredAsset) {
        throw new NotFoundException('Offered asset not found');
      }
      if (offeredAsset.user.id !== initiatorId) {
        throw new ForbiddenException('You do not own the offered asset');
      }

      // Validate requested asset ownership
      const requestedAsset = await this.portfolioRepository.findOne({
        where: { id: createOfferDto.requestedAssetId },
        relations: ['user'],
      });
      if (!requestedAsset) {
        throw new NotFoundException('Requested asset not found');
      }
      if (requestedAsset.user.id !== createOfferDto.recipientId) {
        throw new BadRequestException('Requested asset does not belong to the recipient');
      }

      // Check for existing pending offers between the same assets
      const existingOffer = await this.offerRepository.findOne({
        where: {
          offeredAssetId: createOfferDto.offeredAssetId,
          requestedAssetId: createOfferDto.requestedAssetId,
          status: OfferStatus.PENDING,
        },
      });
      if (existingOffer) {
        throw new BadRequestException('A pending offer already exists for these assets');
      }

      // Create the offer
      const offer = this.offerRepository.create({
        ...createOfferDto,
        initiatorId,
        status: OfferStatus.PENDING,
        expiresAt: createOfferDto.expiresAt ? new Date(createOfferDto.expiresAt) : undefined,
      });

      const savedOffer = await queryRunner.manager.save(Offer, offer);

      // Send notification to recipient
      await this.notificationsService.createAndBroadcast(
        String(createOfferDto.recipientId),
        NotificationType.OfferCreated,
        {
          offerId: savedOffer.id,
          initiatorId,
          offeredAssetName: offeredAsset.name,
          requestedAssetName: requestedAsset.name,
        },
      );

      await queryRunner.commitTransaction();

      return this.mapToResponseDto(savedOffer);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to create offer: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(query: QueryOffersDto, userId: number): Promise<{
    offers: OfferResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 10, status, type, sortBy = 'createdAt', sortOrder = 'DESC' } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.offerRepository
      .createQueryBuilder('offer')
      .leftJoinAndSelect('offer.initiator', 'initiator')
      .leftJoinAndSelect('offer.recipient', 'recipient')
      .leftJoinAndSelect('offer.offeredAsset', 'offeredAsset')
      .leftJoinAndSelect('offer.requestedAsset', 'requestedAsset')
      .leftJoinAndSelect('offeredAsset.user', 'offeredAssetUser')
      .leftJoinAndSelect('requestedAsset.user', 'requestedAssetUser');

    // Filter by user involvement
    if (type === 'sent') {
      queryBuilder.where('offer.initiatorId = :userId', { userId });
    } else if (type === 'received') {
      queryBuilder.where('offer.recipientId = :userId', { userId });
    } else {
      queryBuilder.where(
        '(offer.initiatorId = :userId OR offer.recipientId = :userId)',
        { userId },
      );
    }

    // Filter by status
    if (status) {
      queryBuilder.andWhere('offer.status = :status', { status });
    }

    // Apply sorting
    queryBuilder.orderBy(`offer.${sortBy}`, sortOrder);

    // Get total count
    const total = await queryBuilder.getCount();

    // Apply pagination
    queryBuilder.skip(skip).take(limit);

    const offers = await queryBuilder.getMany();

    return {
      offers: offers.map(offer => this.mapToResponseDto(offer)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, userId: number): Promise<OfferResponseDto> {
    const offer = await this.offerRepository.findOne({
      where: { id },
      relations: [
        'initiator',
        'recipient',
        'offeredAsset',
        'requestedAsset',
        'offeredAsset.user',
        'requestedAsset.user',
      ],
    });

    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    // Check if user has access to this offer
    if (offer.initiatorId !== userId && offer.recipientId !== userId) {
      throw new ForbiddenException('You do not have access to this offer');
    }

    return this.mapToResponseDto(offer);
  }

  async acceptOffer(id: string, userId: number): Promise<OfferResponseDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const offer = await this.offerRepository.findOne({
        where: { id },
        relations: [
          'initiator',
          'recipient',
          'offeredAsset',
          'requestedAsset',
          'offeredAsset.user',
          'requestedAsset.user',
        ],
      });

      if (!offer) {
        throw new NotFoundException('Offer not found');
      }

      if (offer.recipientId !== userId) {
        throw new ForbiddenException('Only the recipient can accept an offer');
      }

      if (offer.status !== OfferStatus.PENDING) {
        throw new BadRequestException('Offer is not in pending status');
      }

      // Check if offer has expired
      if (offer.expiresAt && new Date() > offer.expiresAt) {
        offer.status = OfferStatus.EXPIRED;
        await queryRunner.manager.save(Offer, offer);
        throw new BadRequestException('Offer has expired');
      }

      // Verify current ownership of both assets
      const offeredAsset = await this.portfolioRepository.findOne({
        where: { id: offer.offeredAssetId },
        relations: ['user'],
      });
      const requestedAsset = await this.portfolioRepository.findOne({
        where: { id: offer.requestedAssetId },
        relations: ['user'],
      });

      if (!offeredAsset || !requestedAsset) {
        throw new NotFoundException('One or both assets no longer exist');
      }

      if (offeredAsset.user.id !== offer.initiatorId) {
        throw new BadRequestException('Offered asset is no longer owned by the initiator');
      }

      if (requestedAsset.user.id !== offer.recipientId) {
        throw new BadRequestException('Requested asset is no longer owned by the recipient');
      }

      // Swap asset ownership
      offeredAsset.user = offer.recipient;
      requestedAsset.user = offer.initiator;

      await queryRunner.manager.save(Portfolio, [offeredAsset, requestedAsset]);

      // Update offer status
      offer.status = OfferStatus.ACCEPTED;
      const updatedOffer = await queryRunner.manager.save(Offer, offer);

      // Create transaction records for both parties
      const initiatorTransaction = this.transactionRepository.create({
        type: 'sell',
        amount: offer.offeredAmount || 1,
        price: 0, 
        timestamp: new Date(),
        portfolio: offeredAsset,
      });

      const recipientTransaction = this.transactionRepository.create({
        type: 'buy',
        amount: offer.requestedAmount || 1,
        price: 0, 
        timestamp: new Date(),
        portfolio: requestedAsset,
      });

      await queryRunner.manager.save(Transaction, [initiatorTransaction, recipientTransaction]);

      // Send notifications
      await this.notificationsService.createAndBroadcast(
        String(offer.initiatorId),
        NotificationType.OfferAccepted,
        {
          offerId: offer.id,
          recipientId: offer.recipientId,
          offeredAssetName: offeredAsset.name,
          requestedAssetName: requestedAsset.name,
        },
      );

      await queryRunner.commitTransaction();

      return this.mapToResponseDto(updatedOffer);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to accept offer: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async declineOffer(id: string, userId: number): Promise<OfferResponseDto> {
    const offer = await this.offerRepository.findOne({
      where: { id },
      relations: ['initiator', 'recipient'],
    });

    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    if (offer.recipientId !== userId) {
      throw new ForbiddenException('Only the recipient can decline an offer');
    }

    if (offer.status !== OfferStatus.PENDING) {
      throw new BadRequestException('Offer is not in pending status');
    }

    offer.status = OfferStatus.DECLINED;
    const updatedOffer = await this.offerRepository.save(offer);

    // Send notification to initiator
    await this.notificationsService.createAndBroadcast(
      String(offer.initiatorId),
      NotificationType.OfferDeclined,
      {
        offerId: offer.id,
        recipientId: offer.recipientId,
      },
    );

    return this.mapToResponseDto(updatedOffer);
  }

  async cancelOffer(id: string, userId: number): Promise<OfferResponseDto> {
    const offer = await this.offerRepository.findOne({
      where: { id },
      relations: ['initiator', 'recipient'],
    });

    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    if (offer.initiatorId !== userId) {
      throw new ForbiddenException('Only the initiator can cancel an offer');
    }

    if (offer.status !== OfferStatus.PENDING) {
      throw new BadRequestException('Only pending offers can be cancelled');
    }

    offer.status = OfferStatus.CANCELLED;
    const updatedOffer = await this.offerRepository.save(offer);

    // Send notification to recipient
    await this.notificationsService.createAndBroadcast(
      String(offer.recipientId),
      NotificationType.StatusChanged,
      {
        offerId: offer.id,
        initiatorId: offer.initiatorId,
      },
    );

    return this.mapToResponseDto(updatedOffer);
  }

  async updateOffer(id: string, updateOfferDto: UpdateOfferDto, userId: number): Promise<OfferResponseDto> {
    const offer = await this.offerRepository.findOne({
      where: { id },
    });

    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    if (offer.initiatorId !== userId) {
      throw new ForbiddenException('Only the initiator can update an offer');
    }

    if (offer.status !== OfferStatus.PENDING) {
      throw new BadRequestException('Only pending offers can be updated');
    }

    // Only allow updating certain fields with proper type checking
    const updates: Partial<Offer> = {};

    if (typeof updateOfferDto.message === 'string') {
      updates.message = updateOfferDto.message;
    }
    if (updateOfferDto.expiresAt !== undefined) {
      if (typeof updateOfferDto.expiresAt === 'string') {
        updates.expiresAt = new Date(updateOfferDto.expiresAt);
      } else if ((updateOfferDto.expiresAt as any) instanceof Date) {
        updates.expiresAt = updateOfferDto.expiresAt as Date;
      }
    }
    if (typeof updateOfferDto.offeredAmount === 'number') {
      updates.offeredAmount = updateOfferDto.offeredAmount;
    }
    if (typeof updateOfferDto.requestedAmount === 'number') {
      updates.requestedAmount = updateOfferDto.requestedAmount;
    }

    Object.assign(offer, updates);
    const updatedOffer = await this.offerRepository.save(offer);

    return this.mapToResponseDto(updatedOffer);
  }

  async removeOffer(id: string, userId: number): Promise<void> {
    const offer = await this.offerRepository.findOne({
      where: { id },
    });

    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    if (offer.initiatorId !== userId && offer.recipientId !== userId) {
      throw new ForbiddenException('You do not have permission to delete this offer');
    }

    await this.offerRepository.remove(offer);
  }

  // Cleanup expired offers (should be called by a scheduled task)
  async cleanupExpiredOffers(): Promise<number> {
    const now = new Date();
    const expiredOffers = await this.offerRepository.find({
      where: {
        status: OfferStatus.PENDING,
      },
    });

    const toExpire = expiredOffers.filter(offer => offer.expiresAt && offer.expiresAt < now);
    for (const offer of toExpire) {
      offer.status = OfferStatus.EXPIRED;
    }
    await this.offerRepository.save(toExpire);
    return toExpire.length;
  }

  private mapToResponseDto(offer: Offer): OfferResponseDto {
    return {
      id: offer.id,
      offeredAssetId: offer.offeredAssetId,
      requestedAssetId: offer.requestedAssetId,
      initiatorId: offer.initiatorId,
      recipientId: offer.recipientId,
      status: offer.status,
      offeredAmount: offer.offeredAmount,
      requestedAmount: offer.requestedAmount,
      message: offer.message,
      expiresAt: offer.expiresAt,
      createdAt: offer.createdAt,
      updatedAt: offer.updatedAt,
      initiator: offer.initiator ? {
        id: offer.initiator.id,
        firstname: offer.initiator.firstname,
        lastname: offer.initiator.lastname,
        email: offer.initiator.email,
      } : undefined,
      recipient: offer.recipient ? {
        id: offer.recipient.id,
        firstname: offer.recipient.firstname,
        lastname: offer.recipient.lastname,
        email: offer.recipient.email,
      } : undefined,
      offeredAsset: offer.offeredAsset ? {
        id: offer.offeredAsset.id,
        name: offer.offeredAsset.name,
      } : undefined,
      requestedAsset: offer.requestedAsset ? {
        id: offer.requestedAsset.id,
        name: offer.requestedAsset.name,
      } : undefined,
    };
  }
} 