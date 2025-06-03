import { Injectable } from '@nestjs/common';
import { CreateCryptocurrencyDto } from './dto/create-cryptocurrency.dto';
import { UpdateCryptocurrencyDto } from './dto/update-cryptocurrency.dto';

@Injectable()
export class CryptocurrencyService {
  create(createCryptocurrencyDto: CreateCryptocurrencyDto) {
    return 'This action adds a new cryptocurrency';
  }

  findAll() {
    return `This action returns all cryptocurrency`;
  }

  findOne(id: number) {
    return `This action returns a #${id} cryptocurrency`;
  }

  update(id: number, updateCryptocurrencyDto: UpdateCryptocurrencyDto) {
    return `This action updates a #${id} cryptocurrency`;
  }

  remove(id: number) {
    return `This action removes a #${id} cryptocurrency`;
  }
}
