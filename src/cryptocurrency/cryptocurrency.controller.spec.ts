import { Test, TestingModule } from '@nestjs/testing';
import { CryptocurrencyController } from './cryptocurrency.controller';
import { CryptocurrencyService } from './cryptocurrency.service';

describe('CryptocurrencyController', () => {
  let controller: CryptocurrencyController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CryptocurrencyController],
      providers: [CryptocurrencyService],
    }).compile();

    controller = module.get<CryptocurrencyController>(CryptocurrencyController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
