export class UpdateBalanceDto {
  userId: number; // matches UserBalance.userId
  assetId: number; 
  amount: number; // positive = deposit, negative = withdrawal
  reason: string;
  transactionId?: string;
  relatedOrderId?: string;
}
