import {
  IsOptional,
  IsString,
  IsUrl,
  IsArray,
  IsEnum,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { NotificationEventType } from '../../common/enums/notification-event-type.enum';
import { WebhookStatus } from '../entities/webhook-subscription.entity';

export class UpdateWebhookDto {
  @IsOptional()
  @IsUrl({ require_tld: false, require_protocol: true })
  callbackUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  events?: NotificationEventType[];

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(WebhookStatus)
  status?: WebhookStatus;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  maxFailures?: number;
}
