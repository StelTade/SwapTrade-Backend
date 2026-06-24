export const GOVERNANCE_PARAMS: Record<
  string,
  { value: number; description: string }
> = {
  VOTING_PERIOD_DAYS: {
    value: 7,
    description: 'Default voting period in days',
  },
  MIN_TOKEN_THRESHOLD: {
    value: 10000,
    description: 'Minimum tokens required to create a proposal',
  },
  QUORUM_PERCENTAGE: {
    value: 40,
    description: 'Minimum participation percentage of total supply',
  },
  PASS_THRESHOLD_PERCENTAGE: {
    value: 50,
    description: 'Minimum winning vote percentage',
  },
  DELEGATION_PERIOD_DAYS: {
    value: 30,
    description: 'Default delegation period in days',
  },
  MAX_PROPOSAL_TITLE_LENGTH: {
    value: 200,
    description: 'Maximum character length for proposal titles',
  },
  EMERGENCY_VOTING_PERIOD_DAYS: {
    value: 1,
    description: 'Voting period for emergency proposals',
  },
};

export const GOVERNANCE_CONFIG_KEYS: Record<string, number> = {
  VOTING_PERIOD_DAYS: 7,
  MIN_TOKEN_THRESHOLD: 10000,
  QUORUM_PERCENTAGE: 40,
  PASS_THRESHOLD_PERCENTAGE: 50,
  DELEGATION_PERIOD_DAYS: 30,
  MAX_PROPOSAL_TITLE_LENGTH: 200,
  EMERGENCY_VOTING_PERIOD_DAYS: 1,
};

export const getDefaultConfig = (key: string): number => {
  return GOVERNANCE_CONFIG_KEYS[key] ?? 0;
};
