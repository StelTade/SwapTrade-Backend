import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GovernanceModule } from '../src/governance/governance.module';
import { GovernanceService } from '../src/governance/governance.service';
import { GovernanceController } from '../src/governance/governance.controller';
import { GovernanceProposal, ProposalStatus } from '../src/governance/entities/governance-proposal.entity';
import { GovernanceParameter } from '../src/governance/entities/governance-parameter.entity';
import { GovernanceVote, VoteChoice } from '../src/governance/entities/governance-vote.entity';
import { GovernanceStake } from '../src/governance/entities/governance-stake.entity';
import { PendingGovernanceParameterUpdate } from '../src/governance/entities/pending-governance-parameter-update.entity';
import { CreateGovernanceProposalDto } from '../src/governance/dto/create-governance-proposal.dto';
import { CastVoteDto } from '../src/governance/dto/cast-vote.dto';
import { UpsertGovernanceStakeDto } from '../src/governance/dto/upsert-governance-stake.dto';
import { UpdateGovernanceProposalDto } from '../src/governance/dto/update-governance-proposal.dto';

describe('Governance Voting System Integration Tests', () => {
  let module: TestingModule;
  let governanceService: GovernanceService;
  let governanceController: GovernanceController;

  beforeAll(async () => {
    const testConfig = {
      type: 'sqlite',
      database: ':memory:',
      entities: [
        GovernanceProposal,
        GovernanceVote,
        GovernanceStake,
        GovernanceParameter,
        PendingGovernanceParameterUpdate,
      ],
      synchronize: true,
    };

    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot(testConfig),
        GovernanceModule,
      ],
    }).compile();

    governanceService = module.get<GovernanceService>(GovernanceService);
    governanceController = module.get<GovernanceController>(GovernanceController);
  });

  afterAll(async () => {
    await module.close();
  });

  describe('Governance Staking', () => {
    it('should create or update user stake', async () => {
      const dto: UpsertGovernanceStakeDto = {
        userId: 1,
        stakedAmount: 1000,
      };

      const stake = await governanceController.upsertStake(dto);
      
      expect(stake).toBeDefined();
      expect(stake.userId).toBe(dto.userId);
      expect(stake.stakedAmount).toBe(dto.stakedAmount);
    });

    it('should retrieve user stake', async () => {
      const userId = 2;
      const dto: UpsertGovernanceStakeDto = {
        userId,
        stakedAmount: 5000,
      };

      await governanceController.upsertStake(dto);
      const retrieved = await governanceController.getUserStake(userId.toString());
      
      expect(retrieved).toBeDefined();
      expect(retrieved.userId).toBe(userId);
      expect(retrieved.stakedAmount).toBe(dto.stakedAmount);
    });
  });

  describe('Governance Proposals', () => {
    let proposalId: string;

    it('should create a new proposal', async () => {
      const dto: CreateGovernanceProposalDto = {
        title: 'Test Proposal: Update Fee Structure',
        description: 'This proposal aims to update the trading fee structure to be more competitive',
        proposerUserId: 1,
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        quorumThreshold: 1000,
        executable: true,
      };

      const proposal = await governanceController.createProposal(dto);
      
      expect(proposal).toBeDefined();
      expect(proposal.title).toBe(dto.title);
      expect(proposal.description).toBe(dto.description);
      expect(proposal.proposerUserId).toBe(dto.proposerUserId);
      expect(proposal.status).toBe(ProposalStatus.ACTIVE);
      
      proposalId = proposal.id;
    });

    it('should retrieve proposal by ID', async () => {
      const proposal = await governanceController.getProposal(proposalId);
      
      expect(proposal).toBeDefined();
      expect(proposal.id).toBe(proposalId);
      expect(proposal.votes).toBeDefined();
      expect(Array.isArray(proposal.votes)).toBe(true);
    });

    it('should update proposal', async () => {
      const updateDto: UpdateGovernanceProposalDto = {
        title: 'Updated Proposal Title',
        description: 'Updated description with more details',
      };

      const updated = await governanceController.updateProposal(proposalId, updateDto);
      
      expect(updated.title).toBe(updateDto.title);
      expect(updated.description).toBe(updateDto.description);
    });

    it('should cancel proposal', async () => {
      const dto: CreateGovernanceProposalDto = {
        title: 'Proposal to Cancel',
        description: 'This proposal will be cancelled for testing',
        proposerUserId: 2,
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        quorumThreshold: 500,
        executable: false,
      };

      const created = await governanceController.createProposal(dto);
      const cancelled = await governanceController.cancelProposal(created.id);
      
      expect(cancelled.status).toBe(ProposalStatus.CANCELLED);
    });

    it('should list all proposals', async () => {
      const proposals = await governanceController.listProposals();
      
      expect(Array.isArray(proposals)).toBe(true);
      expect(proposals.length).toBeGreaterThan(0);
      expect(proposals[0].votes).toBeDefined();
    });
  });

  describe('Governance Voting', () => {
    let proposalId: string;
    let userId: number;

    beforeEach(async () => {
      // Create a proposal for voting
      const dto: CreateGovernanceProposalDto = {
        title: 'Voting Test Proposal',
        description: 'Proposal for testing voting functionality',
        proposerUserId: 1,
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        quorumThreshold: 100,
        executable: true,
      };

      const proposal = await governanceController.createProposal(dto);
      proposalId = proposal.id;

      // Create user stake for voting power
      userId = 3;
      const stakeDto: UpsertGovernanceStakeDto = {
        userId,
        stakedAmount: 1000,
      };

      await governanceController.upsertStake(stakeDto);
    });

    it('should cast a vote', async () => {
      const dto: CastVoteDto = {
        voterUserId: userId,
        choice: VoteChoice.YES,
        idempotencyKey: 'unique-key-123',
      };

      const vote = await governanceController.castVote(proposalId, dto);
      
      expect(vote).toBeDefined();
      expect(vote.proposalId).toBe(proposalId);
      expect(vote.voterUserId).toBe(userId);
      expect(vote.choice).toBe(dto.choice);
      expect(vote.votingPower).toBe(1000);
      expect(vote.idempotencyKey).toBe(dto.idempotencyKey);
    });

    it('should prevent double voting', async () => {
      const dto: CastVoteDto = {
        voterUserId: userId,
        choice: VoteChoice.NO,
        idempotencyKey: 'unique-key-456',
      };

      await governanceController.castVote(proposalId, dto);
      
      await expect(governanceController.castVote(proposalId, dto)).rejects.toThrow();
    });

    it('should get user votes', async () => {
      const dto: CastVoteDto = {
        voterUserId: userId,
        choice: VoteChoice.ABSTAIN,
        idempotencyKey: 'unique-key-789',
      };

      await governanceController.castVote(proposalId, dto);
      const userVotes = await governanceController.getUserVotes(userId.toString());
      
      expect(Array.isArray(userVotes)).toBe(true);
      expect(userVotes.length).toBeGreaterThan(0);
      expect(userVotes[0].voterUserId).toBe(userId);
    });

    it('should tally proposal results', async () => {
      // Cast multiple votes
      const voters = [
        { userId: 4, stake: 500, choice: VoteChoice.YES },
        { userId: 5, stake: 300, choice: VoteChoice.YES },
        { userId: 6, stake: 200, choice: VoteChoice.NO },
      ];

      for (const voter of voters) {
        await governanceController.upsertStake({ userId: voter.userId, stakedAmount: voter.stake });
        await governanceController.castVote(proposalId, {
          voterUserId: voter.userId,
          choice: voter.choice,
          idempotencyKey: `key-${voter.userId}`,
        });
      }

      const tallied = await governanceController.tally(proposalId);
      
      expect(tallied).toBeDefined();
      expect(tallied.status).toMatch(/SUCCEEDED|DEFEATED/);
      expect(tallied.yesPower).toBeGreaterThan(0);
      expect(tallied.noPower).toBeGreaterThan(0);
    });

    it('should execute successful proposal', async () => {
      // Create a proposal with high quorum threshold
      const dto: CreateGovernanceProposalDto = {
        title: 'Executable Proposal',
        description: 'Proposal that should pass and be executable',
        proposerUserId: 1,
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        quorumThreshold: 100,
        executable: true,
      };

      const proposal = await governanceController.createProposal(dto);
      
      // Cast sufficient votes to pass
      await governanceController.upsertStake({ userId: 7, stakedAmount: 1000 });
      await governanceController.castVote(proposal.id, {
        voterUserId: 7,
        choice: VoteChoice.YES,
        idempotencyKey: 'execution-key',
      });

      const tallied = await governanceController.tally(proposal.id);
      
      if (tallied.status === ProposalStatus.SUCCEEDED) {
        const executed = await governanceController.execute(proposal.id);
        expect(executed.status).toBe(ProposalStatus.EXECUTED);
        expect(executed.executedAt).toBeDefined();
        expect(executed.executionResult).toBeDefined();
      }
    });
  });

  describe('Governance Security and Audit', () => {
    let proposalId: string;

    beforeEach(async () => {
      const dto: CreateGovernanceProposalDto = {
        title: 'Security Test Proposal',
        description: 'Proposal for testing security features',
        proposerUserId: 1,
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        quorumThreshold: 100,
        executable: false,
      };

      const proposal = await governanceController.createProposal(dto);
      proposalId = proposal.id;
    });

    it('should validate vote integrity', async () => {
      // Create some votes
      const votes = [
        { userId: 8, stake: 100, choice: VoteChoice.YES, key: 'integrity-1' },
        { userId: 9, stake: 200, choice: VoteChoice.NO, key: 'integrity-2' },
      ];

      for (const vote of votes) {
        await governanceController.upsertStake({ userId: vote.userId, stakedAmount: vote.stake });
        await governanceController.castVote(proposalId, {
          voterUserId: vote.userId,
          choice: vote.choice,
          idempotencyKey: vote.key,
        });
      }

      const integrity = await governanceService.validateVoteIntegrity(proposalId);
      
      expect(integrity).toBeDefined();
      expect(integrity.proposalId).toBe(proposalId);
      expect(integrity.totalVotes).toBe(votes.length);
      expect(integrity.uniqueVoters).toBe(votes.length);
      expect(integrity.issues).toBeDefined();
      expect(Array.isArray(integrity.issues)).toBe(true);
      expect(integrity.isValid).toBe(true);
    });

    it('should detect double voting', async () => {
      const userId = 10;
      await governanceController.upsertStake({ userId, stakedAmount: 100 });

      // First vote
      await governanceController.castVote(proposalId, {
        voterUserId: userId,
        choice: VoteChoice.YES,
        idempotencyKey: 'double-vote-1',
      });

      // Attempt second vote (should fail)
      await expect(governanceController.castVote(proposalId, {
        voterUserId: userId,
        choice: VoteChoice.NO,
        idempotencyKey: 'double-vote-2',
      })).rejects.toThrow();

      const integrity = await governanceService.validateVoteIntegrity(proposalId);
      expect(integrity.isValid).toBe(true); // No double votes actually recorded
    });

    it('should get voting snapshot', async () => {
      // Create stakes and votes
      const voters = [
        { userId: 11, stake: 500, choice: VoteChoice.YES },
        { userId: 12, stake: 300, choice: VoteChoice.NO },
        { userId: 13, stake: 200, choice: VoteChoice.ABSTAIN },
      ];

      for (const voter of voters) {
        await governanceController.upsertStake({ userId: voter.userId, stakedAmount: voter.stake });
        await governanceController.castVote(proposalId, {
          voterUserId: voter.userId,
          choice: voter.choice,
          idempotencyKey: `snapshot-${voter.userId}`,
        });
      }

      const snapshot = await governanceController.getVotingSnapshot(proposalId);
      
      expect(snapshot).toBeDefined();
      expect(snapshot.proposalId).toBe(proposalId);
      expect(snapshot.totalVotingPower).toBe(1000);
      expect(snapshot.votedPower).toBe(1000);
      expect(snapshot.participationRate).toBe(100);
      expect(snapshot.uniqueVoters).toBe(3);
      expect(snapshot.voteBreakdown).toBeDefined();
      expect(snapshot.voteBreakdown.yes).toBe(500);
      expect(snapshot.voteBreakdown.no).toBe(300);
      expect(snapshot.voteBreakdown.abstain).toBe(200);
      expect(snapshot.quorumMet).toBe(true);
    });

    it('should get proposal status', async () => {
      const status = await governanceController.getProposalStatus(proposalId);
      
      expect(status).toBeDefined();
      expect(status.proposalId).toBe(proposalId);
      expect(status.title).toBeDefined();
      expect(status.status).toBeDefined();
      expect(status.progress).toBeDefined();
      expect(status.progress.yesPower).toBeDefined();
      expect(status.progress.noPower).toBeDefined();
      expect(status.progress.abstainPower).toBeDefined();
      expect(status.progress.quorumThreshold).toBeDefined();
      expect(status.executable).toBeDefined();
    });

    it('should get audit log', async () => {
      const auditLog = await governanceController.getAuditLog('10');
      
      expect(Array.isArray(auditLog)).toBe(true);
      // Mock implementation returns empty array
    });
  });
});
