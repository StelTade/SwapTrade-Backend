import { Test, TestingModule } from '@nestjs/testing';
import { GovernanceService } from './governance.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  GovernanceProposal,
  GovernanceVote,
  GovernanceDiscussion,
  TokenHolding,
  VoteDelegation,
} from '../entities';
import { GOVERNANCE_PARAMS } from '../constants';

describe('GovernanceService', () => {
  let service: GovernanceService;
  let mockGovernanceProposalRepo: any;
  let mockGovernanceVoteRepo: any;
  let mockGovernanceDiscussionRepo: any;
  let mockTokenHoldingRepo: any;
  let mockVoteDelegationRepo: any;

  beforeEach(async () => {
    mockGovernanceProposalRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn(),
      })),
    };
    mockGovernanceVoteRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    mockGovernanceDiscussionRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    mockTokenHoldingRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    mockVoteDelegationRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GovernanceService,
        {
          provide: getRepositoryToken(GovernanceProposal),
          useValue: mockGovernanceProposalRepo,
        },
        {
          provide: getRepositoryToken(GovernanceVote),
          useValue: mockGovernanceVoteRepo,
        },
        {
          provide: getRepositoryToken(GovernanceDiscussion),
          useValue: mockGovernanceDiscussionRepo,
        },
        {
          provide: getRepositoryToken(TokenHolding),
          useValue: mockTokenHoldingRepo,
        },
        {
          provide: getRepositoryToken(VoteDelegation),
          useValue: mockVoteDelegationRepo,
        },
      ],
    }).compile();

    service = module.get<GovernanceService>(GovernanceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getVotingPeriodDays', () => {
    it('should return the default voting period', async () => {
      const result = await service.getVotingPeriodDays();
      expect(result).toBe(GOVERNANCE_PARAMS.VOTING_PERIOD_DAYS.value);
    });
  });

  describe('getMinTokenThreshold', () => {
    it('should return the minimum token threshold', async () => {
      const result = await service.getMinTokenThreshold();
      expect(result).toBe(GOVERNANCE_PARAMS.MIN_TOKEN_THRESHOLD.value);
    });
  });

  describe('getQuorumPercentage', () => {
    it('should return the quorum percentage', async () => {
      const result = await service.getQuorumPercentage();
      expect(result).toBe(GOVERNANCE_PARAMS.QUORUM_PERCENTAGE.value);
    });
  });

  describe('getPassThresholdPercentage', () => {
    it('should return the pass threshold percentage', async () => {
      const result = await service.getPassThresholdPercentage();
      expect(result).toBe(GOVERNANCE_PARAMS.PASS_THRESHOLD_PERCENTAGE.value);
    });
  });

  describe('getMaxTitleLength', () => {
    it('should return the max title length', async () => {
      const result = await service.getMaxTitleLength();
      expect(result).toBe(GOVERNANCE_PARAMS.MAX_PROPOSAL_TITLE_LENGTH.value);
    });
  });

  describe('getTokenBalance', () => {
    it('should return the token balance for a user', async () => {
      const holding = { balance: 5000 } as TokenHolding;
      mockTokenHoldingRepo.findOne.mockResolvedValue(holding);

      const result = await service.getTokenBalance('user1');
      expect(result).toBe(5000);
    });

    it('should return 0 if user has no token holdings', async () => {
      mockTokenHoldingRepo.findOne.mockResolvedValue(null);
      const result = await service.getTokenBalance('user1');
      expect(result).toBe(0);
    });
  });

  describe('canUserVote', () => {
    it('should allow voting on an active proposal', async () => {
      const proposal = {
        id: 'proposal1',
        status: 'ACTIVE',
        proposerId: 'other-user',
        startTime: new Date(Date.now() - 1000),
        endTime: new Date(Date.now() + 10000),
      } as GovernanceProposal;
      mockGovernanceProposalRepo.findOne.mockResolvedValue(proposal);
      mockGovernanceVoteRepo.findOne.mockResolvedValue(null);

      const result = await service.canUserVote('user1', 'proposal1');
      expect(result.allowed).toBe(true);
    });

    it('should reject voting on own proposal', async () => {
      const proposal = {
        id: 'proposal1',
        status: 'ACTIVE',
        proposerId: 'user1',
        startTime: new Date(Date.now() - 1000),
        endTime: new Date(Date.now() + 10000),
      } as GovernanceProposal;
      mockGovernanceProposalRepo.findOne.mockResolvedValue(proposal);

      const result = await service.canUserVote('user1', 'proposal1');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Cannot vote on your own proposal');
    });

    it('should reject double voting', async () => {
      const proposal = {
        id: 'proposal1',
        status: 'ACTIVE',
        proposerId: 'other-user',
        startTime: new Date(Date.now() - 1000),
        endTime: new Date(Date.now() + 10000),
      } as GovernanceProposal;
      mockGovernanceProposalRepo.findOne.mockResolvedValue(proposal);
      mockGovernanceVoteRepo.findOne.mockResolvedValue({ id: 'vote1' });

      const result = await service.canUserVote('user1', 'proposal1');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('User has already voted on this proposal');
    });
  });

  describe('checkQuorumMet', () => {
    it('should return true when quorum is met', async () => {
      const proposal = {
        id: 'proposal1',
        totalSupply: 100000,
        forVotes: 25000,
        againstVotes: 10000,
        abstainVotes: 15000,
      } as GovernanceProposal;
      mockGovernanceProposalRepo.findOne.mockResolvedValue(proposal);

      const result = await service.checkQuorumMet('proposal1');
      expect(result).toBe(true);
    });

    it('should return false when quorum is not met', async () => {
      const proposal = {
        id: 'proposal1',
        totalSupply: 100000,
        forVotes: 5000,
        againstVotes: 1000,
        abstainVotes: 500,
      } as GovernanceProposal;
      mockGovernanceProposalRepo.findOne.mockResolvedValue(proposal);

      const result = await service.checkQuorumMet('proposal1');
      expect(result).toBe(false);
    });
  });

  describe('proposalHasPassed', () => {
    it('should return true when proposal passes', async () => {
      const proposal = {
        id: 'proposal1',
        totalSupply: 100000,
        quorumVotes: 40,
        passThresholdVotes: 50,
        forVotes: 60000,
        againstVotes: 20000,
        abstainVotes: 10000,
      } as GovernanceProposal;
      mockGovernanceProposalRepo.findOne.mockResolvedValue(proposal);

      const result = await service.proposalHasPassed('proposal1');
      expect(result).toBe(true);
    });

    it('should return false when quorum is not met', async () => {
      const proposal = {
        id: 'proposal1',
        totalSupply: 100000,
        quorumVotes: 50,
        passThresholdVotes: 50,
        forVotes: 10000,
        againstVotes: 10000,
        abstainVotes: 0,
      } as GovernanceProposal;
      mockGovernanceProposalRepo.findOne.mockResolvedValue(proposal);

      const result = await service.proposalHasPassed('proposal1');
      expect(result).toBe(false);
    });
  });

  describe('getProposalHistory', () => {
    it('should return proposals ordered by date', async () => {
      const proposals = [
        { id: 'p1', createdAt: new Date('2026-01-02') },
        { id: 'p2', createdAt: new Date('2026-01-01') },
      ] as GovernanceProposal[];
      mockGovernanceProposalRepo.createQueryBuilder.mockReturnValue({
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(proposals),
      });

      const result = await service.getProposalHistory();
      expect(result).toEqual(proposals);
    });
  });

  describe('getVotingHistory', () => {
    it('should return votes for a user', async () => {
      const votes = [
        { id: 'v1', voterId: 'user1' },
        { id: 'v2', voterId: 'user1' },
      ] as GovernanceVote[];
      mockGovernanceVoteRepo.find.mockResolvedValue(votes);

      const result = await service.getVotingHistory('user1');
      expect(result).toEqual(votes);
    });
  });
});
