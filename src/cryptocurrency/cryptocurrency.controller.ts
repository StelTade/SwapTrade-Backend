import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { CryptocurrencyService } from './cryptocurrency.service';
import { CreateCryptocurrencyDto } from './dto/create-cryptocurrency.dto';
import { UpdateCryptocurrencyDto } from './dto/update-cryptocurrency.dto';

@Controller('cryptocurrency')
export class CryptocurrencyController {
  constructor(private readonly cryptocurrencyService: CryptocurrencyService) {}

  @Post()
  create(@Body() createCryptocurrencyDto: CreateCryptocurrencyDto) {
    return this.cryptocurrencyService.create(createCryptocurrencyDto);
  }

  @Get()
  findAll() {
    return this.cryptocurrencyService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cryptocurrencyService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCryptocurrencyDto: UpdateCryptocurrencyDto) {
    return this.cryptocurrencyService.update(+id, updateCryptocurrencyDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.cryptocurrencyService.remove(+id);
  }
}
