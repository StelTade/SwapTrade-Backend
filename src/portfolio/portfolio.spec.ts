import { Test, TestingModule } from '@nestjs/testing';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';

describe('PortfolioModule', () => {
  let portfolioController: PortfolioController;
  let portfolioService: PortfolioService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PortfolioController],
      providers: [PortfolioService],
    }).compile();

    portfolioController = module.get<PortfolioController>(PortfolioController);
    portfolioService = module.get<PortfolioService>(PortfolioService);
  });

  it('should be defined', () => {
    expect(portfolioController).toBeDefined();
    expect(portfolioService).toBeDefined();
  });

  // Example test (you can adjust depending on your PortfolioService logic)
  it('should call PortfolioService to get all portfolios', async () => {
    const mockResult = [{ id: 1, name: 'Test Portfolio' }];
    jest.spyOn(portfolioService, 'findAll').mockResolvedValue(mockResult as any);

    const result = await portfolioController.findAll();
    expect(result).toEqual(mockResult);
    expect(portfolioService.findAll).toHaveBeenCalled();
  });
});
