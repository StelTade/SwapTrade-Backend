import { Test, TestingModule } from '@nestjs/testing';
import { CryptocurrencyService } from './cryptocurrency.service';


import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cryptocurrency } from './entities/cryptocurrency.entity';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('CryptocurrencyService', () => {
  let service: CryptocurrencyService;
  let cryptoRepo: Repository<Cryptocurrency>;

  const mockRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CryptocurrencyService,
        { provide: getRepositoryToken(Cryptocurrency), useValue: mockRepo },
      ],
    }).compile();
    service = module.get<CryptocurrencyService>(CryptocurrencyService);
    cryptoRepo = module.get<Repository<Cryptocurrency>>(getRepositoryToken(Cryptocurrency));
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw if asset exists', async () => {
      mockRepo.findOne.mockResolvedValue({});
      await expect(service.create({ symbol: 'BTC', name: 'Bitcoin' })).rejects.toThrow(BadRequestException);
    });
    it('should create asset', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue({ symbol: 'BTC', name: 'Bitcoin' });
      mockRepo.save.mockResolvedValue({ symbol: 'BTC', name: 'Bitcoin' });
      await expect(service.create({ symbol: 'BTC', name: 'Bitcoin' })).resolves.toMatchObject({ symbol: 'BTC' });
    });
  });

  describe('findAll', () => {
    it('should return assets', async () => {
      mockRepo.find.mockResolvedValue([{ symbol: 'BTC' }, { symbol: 'ETH' }]);
      await expect(service.findAll()).resolves.toHaveLength(2);
    });
  });

  describe('findOne', () => {
    it('should throw if not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(1)).rejects.toThrow(NotFoundException);
    });
    it('should return asset', async () => {
      mockRepo.findOne.mockResolvedValue({ id: 1, symbol: 'BTC' });
      await expect(service.findOne(1)).resolves.toMatchObject({ symbol: 'BTC' });
    });
  });

  describe('update', () => {
    it('should throw if not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.update(1, { name: 'New' })).rejects.toThrow(NotFoundException);
    });
    it('should update asset', async () => {
      mockRepo.findOne.mockResolvedValue({ id: 1, symbol: 'BTC', name: 'Bitcoin' });
      mockRepo.save.mockResolvedValue({ id: 1, symbol: 'BTC', name: 'New' });
      await expect(service.update(1, { name: 'New' })).resolves.toMatchObject({ name: 'New' });
    });
  });

  describe('remove', () => {
    it('should throw if not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.remove(1)).rejects.toThrow(NotFoundException);
    });
    it('should remove asset', async () => {
      mockRepo.findOne.mockResolvedValue({ id: 1 });
      mockRepo.remove.mockResolvedValue({});
      await expect(service.remove(1)).resolves.toMatchObject({ message: 'Asset removed' });
    });
  });
});
