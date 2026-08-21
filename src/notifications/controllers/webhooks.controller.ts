import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { WebhooksService } from '../services/webhooks.service';
import { RegisterWebhookDto } from '../dto/register-webhook.dto';
import { UpdateWebhookDto } from '../dto/update-webhook.dto';

@UseGuards(JwtAuthGuard)
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  /**
   * Register a new webhook endpoint.
   * Returns the secret only once — the caller must store it.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async register(
    @CurrentUser('sub', ParseUUIDPipe) userId: string,
    @Body() dto: RegisterWebhookDto,
  ) {
    return this.webhooksService.registerWebhook(userId, dto);
  }

  /** List all webhook subscriptions for the authenticated user. */
  @Get()
  async list(@CurrentUser('sub', ParseUUIDPipe) userId: string) {
    return this.webhooksService.getWebhooks(userId);
  }

  /** Get a single webhook subscription by ID. */
  @Get(':id')
  async getById(
    @CurrentUser('sub', ParseUUIDPipe) userId: string,
    @Param('id', ParseUUIDPipe) webhookId: string,
  ) {
    return this.webhooksService.getWebhookById(userId, webhookId);
  }

  /** Update a webhook subscription (URL, events, status, etc.). */
  @Put(':id')
  async update(
    @CurrentUser('sub', ParseUUIDPipe) userId: string,
    @Param('id', ParseUUIDPipe) webhookId: string,
    @Body() dto: UpdateWebhookDto,
  ) {
    return this.webhooksService.updateWebhook(userId, webhookId, dto);
  }

  /** Delete a webhook subscription and all its delivery logs. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser('sub', ParseUUIDPipe) userId: string,
    @Param('id', ParseUUIDPipe) webhookId: string,
  ) {
    await this.webhooksService.deleteWebhook(userId, webhookId);
  }

  /**
   * Rotate the signing secret for a webhook.
   * Returns the new secret — stored once by the caller.
   */
  @Post(':id/rotate-secret')
  async rotateSecret(
    @CurrentUser('sub', ParseUUIDPipe) userId: string,
    @Param('id', ParseUUIDPipe) webhookId: string,
  ) {
    return this.webhooksService.rotateSecret(userId, webhookId);
  }

  /**
   * Get delivery logs for a webhook subscription (or all webhooks for the user).
   * Paginated with page/limit query params.
   */
  @Get(':id/deliveries')
  async getDeliveries(
    @CurrentUser('sub', ParseUUIDPipe) userId: string,
    @Param('id', ParseUUIDPipe) webhookId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
  ) {
    return this.webhooksService.getDeliveryLogs(
      userId,
      webhookId,
      page,
      limit,
    );
  }

  /** Get all delivery logs across all webhooks for the user. */
  @Get('deliveries/all')
  async getAllDeliveries(
    @CurrentUser('sub', ParseUUIDPipe) userId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
  ) {
    return this.webhooksService.getDeliveryLogs(userId, undefined, page, limit);
  }
}
