import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cryptocurrency } from './entities/cryptocurrency.entity';
import { CreateCryptocurrencyDto } from './dto/create-cryptocurrency.dto';
import { UpdateCryptocurrencyDto } from './dto/update-cryptocurrency.dto';

@Injectable()
export class CryptocurrencyService {
  constructor(
    @InjectRepository(Cryptocurrency)
    private readonly cryptoRepo: Repository<Cryptocurrency>,
  ) {}

  async create(dto: CreateCryptocurrencyDto) {
    const exists = await this.cryptoRepo.findOne({ where: [{ symbol: dto.symbol }, { name: dto.name }] });
    if (exists) throw new BadRequestException('Asset with this symbol or name already exists');
    const asset = this.cryptoRepo.create(dto);
    return this.cryptoRepo.save(asset);
  }

  async findAll() {
    return this.cryptoRepo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: number) {
    const asset = await this.cryptoRepo.findOne({ where: { id } });
    if (!asset) throw new NotFoundException('Asset not found');
    return asset;
  }

  async update(id: number, dto: UpdateCryptocurrencyDto) {
    const asset = await this.cryptoRepo.findOne({ where: { id } });
    if (!asset) throw new NotFoundException('Asset not found');
    Object.assign(asset, dto);
    return this.cryptoRepo.save(asset);
  }

  async remove(id: number) {
    const asset = await this.cryptoRepo.findOne({ where: { id } });
    if (!asset) throw new NotFoundException('Asset not found');
    await this.cryptoRepo.remove(asset);
    return { message: 'Asset removed' };
  }
}
