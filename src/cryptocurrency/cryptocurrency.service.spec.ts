import { Test, TestingModule } from '@nestjs/testing';
import { CryptocurrencyService } from './cryptocurrency.service';

describe('CryptocurrencyService', () => {
  let service: CryptocurrencyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CryptocurrencyService],
    }).compile();

    service = module.get<CryptocurrencyService>(CryptocurrencyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
