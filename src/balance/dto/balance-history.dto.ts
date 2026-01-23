export class BalanceHistoryQueryDto {
  startDate?: string;
  endDate?: string;
  asset?: string;
  limit?: number = 50;
  offset?: number = 0;
}

export class BalanceHistoryResponseDto {
  data: BalanceHistoryEntryDto[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export class BalanceHistoryEntryDto {
  asset: string;
  amountChanged: number;
  reason: string;
  timestamp: string;
  resultingBalance: number;
  transactionId?: string;
  relatedOrderId?: string;
}
