import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserBadge } from '../src/rewards/entities/user-badge.entity';

describe('BadgeController (e2e)', () => {
  let app: INestApplication;
  let userBadgeRepository: Repository<UserBadge>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    userBadgeRepository = moduleFixture.get<Repository<UserBadge>>(getRepositoryToken(UserBadge));
  });

  afterAll(async () => {
    await app.close();
  });

  it('/badges/:userId (GET) returns empty array when no badges', async () => {
    const userId = 999999; // unlikely to collide; tests clean up specific records
    await userBadgeRepository.delete({ userId });

    const res = await request(app.getHttpServer())
      .get(`/badges/${userId}`)
      .expect(200);

    expect(res.body).toEqual([]);
  });

  it('/badges/:userId (GET) returns awarded badges', async () => {
    const userId = 424242;
    await userBadgeRepository.delete({ userId });

    const created = await userBadgeRepository.save({ userId, badge: 'EarlyBird' });

    const res = await request(app.getHttpServer())
      .get(`/badges/${userId}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: created.id, badge: 'EarlyBird' }),
      ]),
    );

    await userBadgeRepository.delete({ userId });
  });
});


