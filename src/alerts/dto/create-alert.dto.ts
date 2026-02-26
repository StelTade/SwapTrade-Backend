import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  IsNumber,
  IsInt,
  Min,
  Max,
  ValidateIf,
  Length,
  ArrayNotEmpty,
  ArrayMaxSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AlertType,
  AlertOperator,
  PortfolioChangeType,
} from '../entities/alert-rule.entity';
import { NotificationChannel } from '../../notification/entities/notification.entity';

export class CreateAlertDto {
  @ApiProperty({ example: 'BTC price alert', description: 'Human-readable alert name' })
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiProperty({ enum: AlertType, description: 'Type of alert condition' })
  @IsEnum(AlertType)
  type: AlertType;

  @ApiPropertyOptional({
    example: 'BTCUSDT',
    description: 'Asset symbol (required for PRICE and VOLUME alerts)',
  })
  @ValidateIf((o) => o.type === AlertType.PRICE || o.type === AlertType.VOLUME)
  @IsString()
  @Length(1, 20)
  asset?: string;

  @ApiPropertyOptional({
    enum: AlertOperator,
    description: 'Comparison operator (required for PRICE and VOLUME alerts)',
  })
  @ValidateIf((o) => o.type === AlertType.PRICE || o.type === AlertType.VOLUME)
  @IsEnum(AlertOperator)
  operator?: AlertOperator;

  @ApiPropertyOptional({
    example: 50000,
    description: 'Threshold value to compare against (required for PRICE and VOLUME alerts)',
  })
  @ValidateIf((o) => o.type === AlertType.PRICE || o.type === AlertType.VOLUME)
  @IsNumber()
  @Min(0)
  threshold?: number;

  @ApiPropertyOptional({
    enum: PortfolioChangeType,
    description: 'How to measure portfolio change (required for PORTFOLIO_CHANGE alerts)',
  })
  @ValidateIf((o) => o.type === AlertType.PORTFOLIO_CHANGE)
  @IsEnum(PortfolioChangeType)
  changeType?: PortfolioChangeType;

  @ApiPropertyOptional({
    example: 5.0,
    description: 'Change threshold e.g. 5 for 5% (required for PORTFOLIO_CHANGE alerts)',
  })
  @ValidateIf((o) => o.type === AlertType.PORTFOLIO_CHANGE)
  @IsNumber()
  @Min(0)
  changeThreshold?: number;

  @ApiProperty({
    enum: NotificationChannel,
    isArray: true,
    example: ['EMAIL', 'IN_APP'],
    description: 'Delivery channels for this alert',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(4)
  @IsEnum(NotificationChannel, { each: true })
  channels: NotificationChannel[];

  @ApiPropertyOptional({
    example: 60,
    description: 'Minimum minutes before this alert can fire again (1 to 10080)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10080)
  cooldownMinutes?: number;
}
