import { PartialType } from '@nestjs/mapped-types';
import { CreatePasswordResetDto } from './request-password-reset.dto';

export class UpdatePasswordResetDto extends PartialType(
  CreatePasswordResetDto,
) {}
