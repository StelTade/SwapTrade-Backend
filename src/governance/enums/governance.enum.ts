export enum ProposalType {
  PARAMETER_CHANGE = 'PARAMETER_CHANGE',
  FEE_STRUCTURE = 'FEE_STRUCTURE',
  NEW_FEATURE = 'NEW_FEATURE',
  TREASURY = 'TREASURY',
  EMERGENCY = 'EMERGENCY',
  UPGRADE = 'UPGRADE',
}

export enum ProposalStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  PASSED = 'PASSED',
  EXECUTED = 'EXECUTED',
  DEFEATED = 'DEFEATED',
  CANCELLED = 'CANCELLED',
}

export enum VoteType {
  FOR = 'FOR',
  AGAINST = 'AGAINST',
  ABSTAIN = 'ABSTAIN',
}

export enum DiscussionMessageType {
  COMMENT = 'COMMENT',
  AMENDMENT = 'AMENDMENT',
  INFORMATIONAL = 'INFORMATIONAL',
}

export enum ExecutionStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export const PROPOSAL_TYPE_DESCRIPTIONS: Record<ProposalType, string> = {
  [ProposalType.PARAMETER_CHANGE]: 'Modify system parameters',
  [ProposalType.FEE_STRUCTURE]: 'Adjust platform fee structures',
  [ProposalType.NEW_FEATURE]: 'Request new feature prioritization',
  [ProposalType.TREASURY]: 'Treasury fund allocation',
  [ProposalType.EMERGENCY]: 'Emergency action (fast-track)',
  [ProposalType.UPGRADE]: 'System or protocol upgrade',
};
