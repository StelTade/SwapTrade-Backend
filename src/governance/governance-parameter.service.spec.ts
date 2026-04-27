import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SecurityRole } from '../common/security/role-separation';
import { GovernanceParameter } from './entities/governance-parameter.entity';
import {
  PendingGovernanceParameterUpdate,
} from './entities/pending-governance-parameter-update.entity';
import { GovernanceParameterService } from './governance-parameter.service';

describe('GovernanceParameterService', () => {
  let moduleRef: TestingModule;
  let service: GovernanceParameterService;
  let parameterRepository: Repository<GovernanceParameter>;

  const actor = {
    id: 1,
    roles: [SecurityRole.GOVERNANCE_OPERATOR],
  };

  beforeEach(async () => {
    process.env.GOVERNANCE_PARAMETER_TIMELOCK_MS = '1000';

    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [GovernanceParameter, PendingGovernanceParameterUpdate],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([
          GovernanceParameter,
          PendingGovernanceParameterUpdate,
        ]),
      ],
      providers: [GovernanceParameterService],
    }).compile();

    service = moduleRef.get(GovernanceParameterService);
    parameterRepository = moduleRef.get(getRepositoryToken(GovernanceParameter));
  });

  afterEach(async () => {
    delete process.env.GOVERNANCE_PARAMETER_TIMELOCK_MS;
    await moduleRef.close();
  });

  it('executes a queued update after the timelock and changes only targeted fields', async () => {
    const now = new Date('2026-04-26T12:00:00.000Z');
    const before = await service.getParameter('trading.controls');

    const queued = await service.queueParameterUpdate(
      {
        parameterKey: 'trading.controls',
        patch: { makerFeeBps: 50 },
        delayMs: service.getMinimumTimelockMs(),
      },
      actor,
      now,
    );

    await expect(
      service.executeParameterUpdate(
        queued.id,
        actor,
        new Date(now.getTime() + service.getMinimumTimelockMs() - 1),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    const { parameter, update } = await service.executeParameterUpdate(
      queued.id,
      actor,
      new Date(now.getTime() + service.getMinimumTimelockMs()),
    );

    expect(parameter.value).toEqual({
      ...before.value,
      makerFeeBps: 50,
    });
    expect(update.executionResult?.changedFields).toEqual(['makerFeeBps']);
  });

  it('rejects invalid fields, invalid values, and delays below the minimum', async () => {
    const now = new Date('2026-04-26T12:00:00.000Z');

    await expect(
      service.queueParameterUpdate(
        {
          parameterKey: 'trading.controls',
          patch: { unknownField: 50 },
          delayMs: service.getMinimumTimelockMs(),
        },
        actor,
        now,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.queueParameterUpdate(
        {
          parameterKey: 'trading.controls',
          patch: { makerFeeBps: 501 },
          delayMs: service.getMinimumTimelockMs(),
        },
        actor,
        now,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.queueParameterUpdate(
        {
          parameterKey: 'trading.controls',
          patch: { makerFeeBps: 50 },
          delayMs: service.getMinimumTimelockMs() - 1,
        },
        actor,
        now,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects execution if parameter state changed after queueing', async () => {
    const now = new Date('2026-04-26T12:00:00.000Z');
    const queued = await service.queueParameterUpdate(
      {
        parameterKey: 'trading.controls',
        patch: { makerFeeBps: 50 },
        delayMs: service.getMinimumTimelockMs(),
      },
      actor,
      now,
    );

    const parameter = await parameterRepository.findOneByOrFail({
      key: 'trading.controls',
    });
    parameter.value = {
      ...parameter.value,
      takerFeeBps: 99,
    };
    await parameterRepository.save(parameter);

    await expect(
      service.executeParameterUpdate(
        queued.id,
        actor,
        new Date(now.getTime() + service.getMinimumTimelockMs()),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects KYC operators and dual-role actors from parameter updates', async () => {
    const now = new Date('2026-04-26T12:00:00.000Z');

    await expect(
      service.queueParameterUpdate(
        {
          parameterKey: 'trading.controls',
          patch: { makerFeeBps: 50 },
          delayMs: service.getMinimumTimelockMs(),
        },
        { id: 2, roles: [SecurityRole.KYC_OPERATOR] },
        now,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(
      service.queueParameterUpdate(
        {
          parameterKey: 'trading.controls',
          patch: { makerFeeBps: 50 },
          delayMs: service.getMinimumTimelockMs(),
        },
        {
          id: 3,
          roles: [SecurityRole.GOVERNANCE_OPERATOR, SecurityRole.KYC_OPERATOR],
        },
        now,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
