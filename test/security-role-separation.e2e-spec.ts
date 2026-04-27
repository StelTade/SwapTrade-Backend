import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { KycRecord } from '../src/kyc/entities/kyc-records.entity';
import { KycRole } from '../src/kyc/enum/kyc-role.enum';
import { KycStatus } from '../src/kyc/enum/kyc-status.enum';
import { KycModule } from '../src/kyc/kyc.module';

describe('Role separation integration', () => {
  let app: INestApplication;
  let kycRepository: Repository<KycRecord>;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [KycRecord],
          synchronize: true,
        }),
        KycModule,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use((req, _res, next) => {
      (req as any).user = {
        id: Number(req.header('x-user-id')),
        roles: String(req.header('x-roles') ?? '')
          .split(',')
          .map((role) => role.trim())
          .filter(Boolean),
      };
      next();
    });
    await app.init();

    kycRepository = moduleRef.get(getRepositoryToken(KycRecord));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await kycRepository.clear();
    await kycRepository.save(
      kycRepository.create({
        userId: 20,
        status: KycStatus.PENDING,
        reviewedBy: null,
        notes: null,
      }),
    );
  });

  it('prevents governance operators from calling KYC status endpoints', async () => {
    await request(app.getHttpServer())
      .patch('/kyc/20/status')
      .set('x-user-id', '99')
      .set('x-roles', KycRole.GOVERNANCE_OPERATOR)
      .send({ nextStatus: KycStatus.IN_REVIEW })
      .expect(403);
  });

  it('prevents dual-role actors from calling KYC status endpoints', async () => {
    await request(app.getHttpServer())
      .patch('/kyc/20/status')
      .set('x-user-id', '99')
      .set('x-roles', `${KycRole.GOVERNANCE_OPERATOR},${KycRole.KYC_OPERATOR}`)
      .send({ nextStatus: KycStatus.IN_REVIEW })
      .expect(403);
  });

  it('allows a KYC operator to call KYC status endpoints', async () => {
    await request(app.getHttpServer())
      .patch('/kyc/20/status')
      .set('x-user-id', '99')
      .set('x-roles', KycRole.KYC_OPERATOR)
      .send({ nextStatus: KycStatus.IN_REVIEW })
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe(KycStatus.IN_REVIEW);
        expect(body.reviewedBy).toBe('99');
      });
  });
});
