import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tutorial } from './entities/tutorial.entity';
import { TutorialProgress } from './entities/tutorial-progress.entity';

@Injectable()
export class TutorialService {
  constructor(
    @InjectRepository(Tutorial) private tutorialRepo: Repository<Tutorial>,
    @InjectRepository(TutorialProgress) private progressRepo: Repository<TutorialProgress>,
  ) {}

  async findAll() {
    return this.tutorialRepo.find({ where: { isActive: true } });
  }

  async startTutorial(userId: string, tutorialId: string) {
    const existing = await this.progressRepo.findOne({ where: { userId, tutorial: { id: tutorialId } } });
    if (existing) return existing;

    const tutorial = await this.tutorialRepo.findOne({ where: { id: tutorialId } });
    if (!tutorial) throw new NotFoundException('Tutorial not found');

    const progress = this.progressRepo.create({ userId, tutorial });
    return this.progressRepo.save(progress);
  }

  async updateProgress(userId: string, tutorialId: string, step: number) {
    const progress = await this.progressRepo.findOne({ where: { userId, tutorial: { id: tutorialId } } });
    if (!progress) throw new NotFoundException('Progress not found');

    progress.currentStep = step;

    // Mark completed
    const tutorial = await this.tutorialRepo.findOne({ where: { id: tutorialId } });
    if (step >= tutorial!.steps.length) {
      progress.isCompleted = true;
      progress.rewardClaimedAt = new Date();
    }

    return this.progressRepo.save(progress);
  }

  async getProgress(userId: string, tutorialId: string) {
    return this.progressRepo.findOne({ where: { userId, tutorial: { id: tutorialId } } });
  }
}
