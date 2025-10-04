import { Test, TestingModule } from '@nestjs/testing';
import { TutorialService } from './tutorial.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Tutorial } from './entities/tutorial.entity';
import { TutorialProgress } from './entities/tutorial-progress.entity';
import { Repository } from 'typeorm';

describe('TutorialService', () => {
  let service: TutorialService;
  let tutorialRepo: Repository<Tutorial>;
  let progressRepo: Repository<TutorialProgress>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TutorialService,
        { provide: getRepositoryToken(Tutorial), useClass: Repository },
        { provide: getRepositoryToken(TutorialProgress), useClass: Repository },
      ],
    }).compile();

    service = module.get<TutorialService>(TutorialService);
    tutorialRepo = module.get(getRepositoryToken(Tutorial));
    progressRepo = module.get(getRepositoryToken(TutorialProgress));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should start tutorial', async () => {
    const tutorial = { id: '1', steps: [{ title: 'Step 1', content: 'Intro' }] } as Tutorial;
    jest.spyOn(tutorialRepo, 'findOne').mockResolvedValueOnce(tutorial);
    jest.spyOn(progressRepo, 'create').mockReturnValue({ userId: 'user1', tutorial } as any);
    jest.spyOn(progressRepo, 'save').mockResolvedValueOnce({ userId: 'user1', tutorial } as any);

    const result = await service.startTutorial('user1', '1');
    expect(result.userId).toBe('user1');
  });
});
