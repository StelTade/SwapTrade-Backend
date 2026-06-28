import { PartialType } from '@nestjs/mapped-types';
import { CreateMarginPairConfigDto } from './create-margin-pair-config.dto';

export class UpdateMarginPairConfigDto extends PartialType(
  CreateMarginPairConfigDto,
) {}
