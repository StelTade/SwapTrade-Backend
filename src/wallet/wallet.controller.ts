import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { WalletLedgerService } from './services/wallet-ledger.service';
import { DepositService } from './services/deposit.service';
import { WithdrawalService } from './services/withdrawal.service';
import { FiatPaymentService } from './services/fiat-payment.service';
import { BalanceQueryDto } from './dto/balance-query.dto';
import { DepositAddressDto } from './dto/deposit-address.dto';
import { VerifyDepositDto } from './dto/verify-deposit.dto';
import { InitiateWithdrawalDto } from './dto/initiate-withdrawal.dto';
import { FiatIntentDto } from './dto/fiat-intent.dto';

/**
 * User-facing wallet API. Ledger operations key on `user.userId` (the account
 * uuid) and 2FA lookups on `user.sub` (the auth-credential id) — never on a
 * non-existent `user.id`.
 */
@ApiTags('wallet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(
    private readonly ledger: WalletLedgerService,
    private readonly deposits: DepositService,
    private readonly withdrawals: WithdrawalService,
    private readonly fiat: FiatPaymentService,
  ) {}

  // ─── balances & ledger ──────────────────────────────────────────────

  @Get('balance')
  @ApiOperation({ summary: 'Get available/reserved/total balance for an asset' })
  getBalance(@CurrentUser() user: JwtPayload, @Query() query: BalanceQueryDto) {
    return this.ledger.getBalance(user.userId, query.asset ?? 'USDC');
  }

  @Get('balances')
  @ApiOperation({ summary: 'Get all wallet balances for the current user' })
  getBalances(@CurrentUser() user: JwtPayload) {
    return this.ledger.getBalances(user.userId);
  }

  @Get('ledger')
  @ApiOperation({ summary: 'Get append-only ledger history' })
  getLedger(@CurrentUser() user: JwtPayload, @Query() query: BalanceQueryDto) {
    return this.ledger.getLedgerHistory(user.userId, query.asset);
  }

  // ─── deposits ────────────────────────────────────────────────────────

  @Post('deposit/address')
  @ApiOperation({ summary: 'Get or create a deposit address for a network' })
  depositAddress(
    @CurrentUser() user: JwtPayload,
    @Body() dto: DepositAddressDto,
  ) {
    return this.deposits.getDepositAddress(user.userId, dto.network);
  }

  @Post('deposit/verify')
  @ApiOperation({ summary: 'Verify a deposit by tx hash and credit if confirmed' })
  verifyDeposit(
    @CurrentUser() user: JwtPayload,
    @Body() dto: VerifyDepositDto,
  ) {
    return this.deposits.verifyAndCreditDeposit(
      user.userId,
      dto.network,
      dto.txHash,
    );
  }

  @Get('deposits')
  @ApiOperation({ summary: 'List the current user deposit history' })
  listDeposits(@CurrentUser() user: JwtPayload) {
    return this.deposits.listUserDeposits(user.userId);
  }

  // ─── withdrawals ───────────────────────────────────────────────────────

  @Post('withdrawals')
  @ApiOperation({ summary: 'Initiate a withdrawal (2FA required above threshold)' })
  initiateWithdrawal(
    @CurrentUser() user: JwtPayload,
    @Body() dto: InitiateWithdrawalDto,
  ) {
    return this.withdrawals.initiateWithdrawal(user.userId, user.sub, dto);
  }

  @Get('withdrawals')
  @ApiOperation({ summary: 'List the current user withdrawals' })
  listWithdrawals(@CurrentUser() user: JwtPayload) {
    return this.withdrawals.listUserWithdrawals(user.userId);
  }

  @Get('withdrawals/:id')
  @ApiOperation({ summary: 'Get a single withdrawal by id' })
  getWithdrawal(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.withdrawals.getUserWithdrawal(user.userId, id);
  }

  @Post('withdrawals/:id/cancel')
  @ApiOperation({ summary: 'Cancel a withdrawal (while pending or queued)' })
  cancelWithdrawal(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.withdrawals.cancelWithdrawal(user.userId, id);
  }

  // ─── fiat ──────────────────────────────────────────────────────────────

  @Post('fiat/deposit-intent')
  @ApiOperation({ summary: 'Create a fiat deposit intent (credits on settle)' })
  fiatDepositIntent(
    @CurrentUser() user: JwtPayload,
    @Body() dto: FiatIntentDto,
  ) {
    return this.fiat.createDepositIntent(user.userId, dto);
  }

  @Post('fiat/payout')
  @ApiOperation({ summary: 'Create a fiat payout (debits available funds)' })
  fiatPayout(@CurrentUser() user: JwtPayload, @Body() dto: FiatIntentDto) {
    return this.fiat.createPayout(user.userId, dto);
  }

  @Get('fiat/intents')
  @ApiOperation({ summary: 'List the current user fiat intents' })
  fiatIntents(@CurrentUser() user: JwtPayload) {
    return this.fiat.getUserIntents(user.userId);
  }

  @Public()
  @Post('fiat/webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'Provider webhook endpoint (no auth; signature verified)' })
  fiatWebhook(
    @Body() payload: Record<string, any>,
    @Headers('x-provider-signature') signature?: string,
  ) {
    return this.fiat.handleWebhook(payload, signature);
  }
}
