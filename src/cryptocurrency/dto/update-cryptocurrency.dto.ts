import { PartialType } from '@nestjs/mapped-types';
import { CreateCryptocurrencyDto } from './create-cryptocurrency.dto';

export class UpdateCryptocurrencyDto extends PartialType(CreateCryptocurrencyDto) {}
