import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

export class QueueParameterUpdateDto {
  @IsString()
  @Matches(/^[a-z][a-z0-9.-]{2,79}$/)
  parameterKey: string;

  @IsObject()
  patch: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(0)
  delayMs?: number;
}
