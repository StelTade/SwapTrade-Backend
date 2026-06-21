import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ProposalStatus,
  ProposalType,
  VoteType,
  DiscussionMessageType,
  GOVERNANCE_PARAMS,
} from '../constants/governance.constants';
import {
  GovernanceProposal,
  GovernanceVote,
  GovernanceDiscussion,
  TokenHolding,
  VoteDelegation,
} from '../entities';

@Injectable()
export class GovernanceService {
  private readonly logger = new Logger(GovernanceService.name);

  constructor(
    @InjectRepository(GovernanceProposal)
    private readonly proposalRepo: Repository<GovernanceProposal>,
    @InjectRepository(GovernanceVote)
    private readonly voteRepo: Repository<GovernanceVote>,
    @InjectRepository(GovernanceDiscussion)
    private readonly discussionRepo: Repository<GovernanceDiscussion>,
    @InjectRepository(TokenHolding)
    private readonly holdingRepo: Repository<TokenHolding>,
    @InjectRepository(VoteDelegation)
    private readonly delegationRepo: Repository<VoteDelegation>,
  ) {}

  async getVotingPeriodDays(): Promise<number> {
    return GOVERNANCE_PARAMS.VOTING_PERIOD_DAYS.value;
  }

  async getEmergencyVotingPeriodDays(): Promise<number> {
    return GOVERNANCE_PARAMS.EMERGENCY_VOTING_PERIOD_DAYS.value;
  }

  async getMinTokenThreshold(): Promise<number> {
    return GOVERNANCE_PARAMS.MIN_TOKEN_THRESHOLD.value;
  }

  async getQuorumPercentage(): Promise<number> {
    return GOVERNANCE_PARAMS.QUORUM_PERCENTAGE.value;
  }

  async getPassThresholdPercentage(): Promise<number> {
    return GOVERNANCE_PARAMS.PASS_THRESHOLD_PERCENTAGE.value;
  }

  async getMaxTitleLength(): Promise<number> {
    return GOVERNANCE_PARAMS.MAX_PROPOSAL_TITLE_LENGTH.value;
  }

  async getTokenBalance(userId: string, assetId: number = 0): Promise<number> {
    const holding = await this.holdingRepo.findOne({
      where: { userId, assetId },
    });

    return holding?.balance ?? 0;
  }

  async getEffectiveVotingPower(userId: string, proposalId: string): Promise<number> {
    const delegations = await this.delegationRepo.find({
      where: { delegateeId: userId, isActive: true },
    });

    let power = await this.getTokenBalance(userId);

    for (const delegation of delegations) {
      if (delegation.proposalId && delegation.proposalId !== proposalId) {
        continue;
      }
      if (delegation.endTime && new Date(delegation.endTime) < new Date()) {
        continue;
      }
      power += delegation.delegatedBalance;
    }

    return power;
  }

  async isVotingActive(proposal: GovernanceProposal): Promise<boolean> {
    const now = new Date();
    return proposal.status === ProposalStatus.ACTIVE && now >= proposal.startTime && now <= proposal.endTime;
  }

  async canUserVote(
    userId: string,
    proposalId: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const proposal = await this.proposalRepo.findOne({ where: { id: proposalId } });
    if (!proposal) {
      return { allowed: false, reason: 'Proposal not found' };
    }

    if (proposal.status !== ProposalStatus.ACTIVE) {
      return { allowed: false, reason: 'Proposal is not active for voting' };
    }

    const now = new Date();
    if (now < proposal.startTime) {
      return { allowed: false, reason: 'Voting period has not started' };
    }
    if (now > proposal.endTime) {
      return { allowed: false, reason: 'Voting period has ended' };
    }

    if (proposal.proposerId === userId) {
      return { allowed: false, reason: 'Cannot vote on your own proposal' };
    }

    const existingVote = await this.voteRepo.findOne({
      where: { proposalId, voterId: userId },
    });
    if (existingVote) {
      return { allowed: false, reason: 'User has already voted on this proposal' };
    }

    return { allowed: true };
  }

  async checkQuorumMet(proposalId: string): Promise<boolean> {
    const proposal = await this.proposalRepo.findOne({ where: { id: proposalId } });
    if (!proposal) {
      return false;
    }

    const totalVotes = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
    const quorumRequired = (proposal.totalSupply * proposal.quorumVotes) / 100;
    return totalVotes >= quorumRequired;
  }

  async proposalHasPassed(proposalId: string): Promise<boolean> {
    const proposal = await this.proposalRepo.findOne({ where: { id: proposalId } });
    if (!proposal) {
      return false;
    }

    const quorumMet = await this.checkQuorumMet(proposalId);
    if (!quorumMet) {
      return false;
    }

    const totalVotes = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
    if (totalVotes === 0) {
      return false;
    }

    const forPercentage = (proposal.forVotes / totalVotes) * 100;
    return forPercentage >= proposal.passThresholdVotes;
  }

  async getProposalHistory(userId?: string, limit: number = 50): Promise<GovernanceProposal[]> {
    const queryBuilder = this.proposalRepo
      .createQueryBuilder('proposal')
      .orderBy('proposal.createdAt', 'DESC')
      .take(limit);

    if (userId) {
      queryBuilder.where('proposal.proposerId = :userId', { userId });
    }

    return queryBuilder.getMany();
  }

  async getVotingHistory(userId: string, limit: number = 50): Promise<GovernanceVote[]> {
    return this.voteRepo.find({
      where: { voterId: userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
