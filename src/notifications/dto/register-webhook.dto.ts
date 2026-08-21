import {
  IsNotEmpty,
  IsString,
  IsUrl,
  IsArray,
  IsOptional,
  IsNumber,
  Min,
  Max,
  ArrayNotEmpty,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { NotificationEventType } from '../../common/enums/notification-event-type.enum';

export class RegisterWebhookDto {
  @IsNotEmpty()
  @IsUrl({ require_tld: false, require_protocol: true })
  callbackUrl: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  events?: NotificationEventType[];

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  maxFailures?: number;
}
