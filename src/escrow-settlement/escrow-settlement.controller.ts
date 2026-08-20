import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AdminGuard } from '../common/guards/admin.guard';
import { EscrowService } from './services/escrow.service';
import { SettlementService } from './services/settlement.service';
import {
  ManualSettleDto,
  ManualRefundDto,
  RaiseDisputeDto,
  ResolveDisputeDto,
  EscrowQueryDto,
} from './dto/escrow-settlement.dto';
import { EscrowStatus, RefundReason } from './enums/escrow.enums';

/**
 * EscrowSettlementController — admin endpoints for managing escrow accounts,
 * settlements, refunds, and dispute resolution.
 *
 * All endpoints require admin authentication (AdminGuard) and are
 * rate-limited. Every action is recorded in the audit trail via
 * the underlying services.
 */
@ApiTags('Escrow & Settlement')
@Controller('admin/escrow-settlement')
@UseGuards(AdminGuard)
@Throttle({ default: { limit: 30, ttl: 60000 } })
export class EscrowSettlementController {
  constructor(
    private readonly escrowService: EscrowService,
    private readonly settlementService: SettlementService,
  ) {}

  // ─── Escrow Account Endpoints ──────────────────────────────────────

  @Get('escrows')
  @ApiOperation({ summary: 'List all escrow accounts with optional filters' })
  @ApiResponse({ status: 200, description: 'Paginated list of escrow accounts' })
  async listEscrows(@Query() query: EscrowQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const status = query.status as EscrowStatus | undefined;

    if (query.swapId) {
      const escrows = await this.escrowService.getBySwapId(query.swapId);
      return { data: escrows, total: escrows.length, page: 1, totalPages: 1 };
    }

    if (query.userId) {
      const escrows = await this.escrowService.getByUserId(query.userId, status);
      return { data: escrows, total: escrows.length, page: 1, totalPages: 1 };
    }

    return this.escrowService.getAll(page, limit, status);
  }

  @Get('escrows/:id')
  @ApiOperation({ summary: 'Get escrow account details' })
  @ApiResponse({ status: 200, description: 'Escrow account details' })
  @ApiResponse({ status: 404, description: 'Escrow not found' })
  async getEscrow(@Param('id', ParseUUIDPipe) id: string) {
    return this.escrowService.getById(id);
  }

  @Get('escrows/:id/transactions')
  @ApiOperation({ summary: 'Get transaction history for an escrow account' })
  @ApiResponse({ status: 200, description: 'List of escrow transactions' })
  async getEscrowTransactions(@Param('id', ParseUUIDPipe) id: string) {
    return this.escrowService.getTransactions(id);
  }

  // ─── Manual Settlement ─────────────────────────────────────────────

  @Post('settle')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually settle an escrow account (release funds to counterparty)' })
  @ApiResponse({ status: 200, description: 'Settlement transaction recorded' })
  @ApiResponse({ status: 400, description: 'Invalid settlement request' })
  @ApiResponse({ status: 404, description: 'Escrow not found' })
  async manualSettle(@Body() dto: ManualSettleDto) {
    return this.escrowService.releaseFunds(
      dto.escrowAccountId,
      dto.amount,
      dto.adminUserId,
    );
  }

  @Post('settle/swap/:swapId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Fully settle an entire swap (both escrow sides)' })
  @ApiResponse({ status: 200, description: 'Swap fully settled' })
  async settleSwap(
    @Param('swapId') swapId: string,
    @Body() body: { adminUserId: number },
  ) {
    return this.settlementService.settleSwap(swapId, body.adminUserId);
  }

  @Post('settle/swap/:swapId/partial')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Partially settle a swap (one or both sides, partial amounts)' })
  @ApiResponse({ status: 200, description: 'Partial settlement recorded' })
  async partialSettleSwap(
    @Param('swapId') swapId: string,
    @Body() body: {
      sellerAmount?: number;
      buyerAmount?: number;
      adminUserId: number;
    },
  ) {
    return this.settlementService.partialSettleSwap(
      swapId,
      { sellerAmount: body.sellerAmount, buyerAmount: body.buyerAmount },
      body.adminUserId,
    );
  }

  // ─── Manual Refund ─────────────────────────────────────────────────

  @Post('refund')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually refund an escrow account (return funds to depositor)' })
  @ApiResponse({ status: 200, description: 'Refund transaction recorded' })
  @ApiResponse({ status: 400, description: 'Invalid refund request' })
  @ApiResponse({ status: 404, description: 'Escrow not found' })
  async manualRefund(@Body() dto: ManualRefundDto) {
    return this.escrowService.refundFunds(
      dto.escrowAccountId,
      dto.amount,
      dto.reasonCode,
      dto.adminUserId,
      dto.description,
    );
  }

  @Post('refund/swap/:swapId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refund an entire swap (both escrow sides)' })
  @ApiResponse({ status: 200, description: 'Swap fully refunded' })
  async refundSwap(
    @Param('swapId') swapId: string,
    @Body() body: {
      reasonCode: RefundReason;
      adminUserId: number;
      description?: string;
    },
  ) {
    return this.settlementService.refundSwap(
      swapId,
      body.reasonCode,
      body.adminUserId,
      body.description,
    );
  }

  // ─── Dispute Management ────────────────────────────────────────────

  @Post('disputes/raise')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Raise a dispute on an escrow account (freezes escrow)' })
  @ApiResponse({ status: 200, description: 'Dispute raised successfully' })
  @ApiResponse({ status: 400, description: 'Cannot dispute in current status' })
  async raiseDispute(@Body() dto: RaiseDisputeDto) {
    const escrow = await this.escrowService.getById(dto.escrowAccountId);
    return this.settlementService.raiseDispute(
      escrow.swapId,
      dto.escrowAccountId,
      dto.reason,
      dto.description,
      dto.raisedBy,
    );
  }

  @Post('disputes/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resolve a dispute (SETTLE or REFUND)' })
  @ApiResponse({ status: 200, description: 'Dispute resolved' })
  @ApiResponse({ status: 400, description: 'Escrow is not in DISPUTED status' })
  async resolveDispute(@Body() dto: ResolveDisputeDto) {
    const escrow = await this.escrowService.getById(dto.escrowAccountId);
    return this.settlementService.resolveDispute(
      escrow.swapId,
      dto.escrowAccountId,
      dto.resolution,
      dto.adminUserId,
      dto.notes,
      dto.amount,
    );
  }

  @Get('disputes')
  @ApiOperation({ summary: 'List all settlements with active disputes' })
  @ApiResponse({ status: 200, description: 'List of disputed settlements' })
  async listDisputes() {
    return this.settlementService.getDisputedSettlements();
  }

  // ─── Settlement Queries ────────────────────────────────────────────

  @Get('settlements')
  @ApiOperation({ summary: 'List all settlements with optional filters' })
  @ApiResponse({ status: 200, description: 'Paginated list of settlements' })
  async listSettlements(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('result') result?: string,
  ) {
    return this.settlementService.getAllSettlements(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
      result as any,
    );
  }

  @Get('settlements/:id')
  @ApiOperation({ summary: 'Get settlement details' })
  @ApiResponse({ status: 200, description: 'Settlement details' })
  async getSettlement(@Param('id', ParseUUIDPipe) id: string) {
    return this.settlementService.getSettlement(id);
  }

  @Get('settlements/swap/:swapId')
  @ApiOperation({ summary: 'Get settlement by swap id' })
  @ApiResponse({ status: 200, description: 'Settlement for the given swap' })
  async getSettlementBySwapId(@Param('swapId') swapId: string) {
    return this.settlementService.getSettlementBySwapId(swapId);
  }

  @Get('transactions/swap/:swapId')
  @ApiOperation({ summary: 'Get all escrow transactions for a swap (both sides)' })
  @ApiResponse({ status: 200, description: 'List of transactions for the swap' })
  async getSwapTransactions(@Param('swapId') swapId: string) {
    return this.escrowService.getTransactionsBySwapId(swapId);
  }
}
