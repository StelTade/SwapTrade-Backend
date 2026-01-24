export class GetUserBalancesDto {
  asset: string;
  balance: number;
}

export class GetUserBalancesResponseDto {
  data: GetUserBalancesDto[];
  total: number;
  limit: number;
  offset: number;

  constructor(
    data: GetUserBalancesDto[],
    total: number,
    limit: number,
    offset: number,
  ) {
    this.data = data;
    this.total = total;
    this.limit = limit;
    this.offset = offset;
  }
}
