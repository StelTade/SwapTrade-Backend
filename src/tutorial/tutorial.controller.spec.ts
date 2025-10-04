import { Test, TestingModule } from '@nestjs/testing';
import { TutorialController } from './tutorial.controller';
import { TutorialService } from './tutorial.service';

describe('TutorialController', () => {
  let controller: TutorialController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TutorialController],
      providers: [TutorialService],
    }).compile();

    controller = module.get<TutorialController>(TutorialController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
