import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueueService } from '../../queue/queue.service';
import { Auth } from '../../auth/entities/auth.entity';
import { User } from '../../user/entities/user.entity';
import {
  MarginCallEvent,
  PositionLiquidatedEvent,
  PositionOpenedEvent,
} from '../../infrastructure/events/domain.events';

interface NotificationContact {
  email: string;
  phone?: string;
  username: string;
}

@Injectable()
export class MarginListener {
  private readonly logger = new Logger(MarginListener.name);

  constructor(
    private readonly queueService: QueueService,
    @InjectRepository(Auth)
    private readonly authRepo: Repository<Auth>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  @OnEvent('position.opened')
  handlePositionOpened(event: PositionOpenedEvent): void {
    this.logger.log(
      `Margin position opened: ${event.positionId} user=${event.userId} leverage=${event.leverage}x`,
    );
  }

  @OnEvent('margin.call')
  async handleMarginCall(event: MarginCallEvent): Promise<void> {
    this.logger.warn(
      `Margin call for position ${event.positionId} user=${event.userId} ratio=${event.marginRatio.toFixed(4)}`,
    );

    const contact = await this.resolveContact(event.userId);
    if (!contact) return;

    const message =
      `Your margin position is approaching liquidation. ` +
      `Current price: ${event.currentPrice}, liquidation price: ${event.liquidationPrice}, ` +
      `margin ratio: ${event.marginRatio.toFixed(2)}. Add collateral or reduce exposure.`;

    await this.queueService.addNotificationJob({
      userId: String(event.userId),
      type: 'system_alert',
      title: 'Margin Call Warning',
      message,
      data: {
        positionId: event.positionId,
        eventType: 'MARGIN_CALL',
        marginRatio: event.marginRatio,
        liquidationPrice: event.liquidationPrice,
      },
      priority: 'high',
    });

    await this.queueService.addEmailJob({
      to: contact.email,
      subject: 'Margin Call Warning — Action Required',
      template: 'margin-call',
      context: {
        username: contact.username,
        positionId: event.positionId,
        currentPrice: event.currentPrice,
        liquidationPrice: event.liquidationPrice,
        marginRatio: event.marginRatio,
      },
    });

    if (contact.phone) {
      await this.queueService.addNotificationJob({
        userId: String(event.userId),
        type: 'system_alert',
        title: 'Margin Call SMS',
        message,
        data: {
          channel: 'sms',
          phoneNumber: contact.phone,
          eventType: 'MARGIN_CALL_SMS',
        },
        priority: 'high',
      });
    }
  }

  @OnEvent('position.liquidated')
  async handlePositionLiquidated(
    event: PositionLiquidatedEvent,
  ): Promise<void> {
    this.logger.warn(
      `Position liquidated: ${event.positionId} user=${event.userId} shortfall=${event.shortfall}`,
    );

    const contact = await this.resolveContact(event.userId);
    if (!contact) return;

    await this.queueService.addNotificationJob({
      userId: String(event.userId),
      type: 'system_alert',
      title: 'Position Liquidated',
      message: `Your margin position ${event.positionId} was liquidated at price ${event.liquidationPrice}.`,
      data: {
        positionId: event.positionId,
        eventType: 'POSITION_LIQUIDATED',
        shortfall: event.shortfall,
      },
      priority: 'high',
    });

    await this.queueService.addEmailJob({
      to: contact.email,
      subject: 'Position Liquidated',
      template: 'position-liquidated',
      context: {
        username: contact.username,
        positionId: event.positionId,
        liquidationPrice: event.liquidationPrice,
        shortfall: event.shortfall,
      },
    });
  }

  /**
   * Trading modules use numeric userId; resolve contact via auth/user records
   * ordered by creation time (consistent with balance and order modules).
   */
  private async resolveContact(
    userId: number,
  ): Promise<NotificationContact | null> {
    const auths = await this.authRepo.find({
      order: { createdAt: 'ASC' },
      skip: Math.max(0, userId - 1),
      take: 1,
    });
    const auth = auths[0];
    if (!auth) {
      this.logger.warn(`No auth record for trading userId ${userId}`);
      return null;
    }

    const users = await this.userRepo.find({
      where: { email: auth.email },
      take: 1,
    });
    const user = users[0];

    return {
      email: auth.email,
      phone: user?.phoneNumber ?? undefined,
      username: user?.username ?? auth.email,
    };
  }
}
