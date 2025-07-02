import { PartialType } from '@nestjs/mapped-types';
import { RequestPasswordResetDto } from './request-password-reset.dto';

export class UpdatePasswordResetDto extends PartialType(
  RequestPasswordResetDto,
) {}
