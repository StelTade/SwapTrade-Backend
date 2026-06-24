import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StellarService } from './services/stellar.service';
import { EthereumService } from './services/ethereum.service';
import { CrossChainBridgeService } from './services/cross-chain-bridge.service';
import {
  DepositAddressDto,
  WithdrawDto,
  BridgeTransferDto,
  VerifyDepositDto,
} from './dto/blockchain.dto';
import { BlockchainNetwork } from './entities/blockchain-transaction.entity';

@ApiTags('blockchain')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('blockchain')
export class BlockchainController {
  constructor(
    private readonly stellarService: StellarService,
    private readonly ethereumService: EthereumService,
    private readonly bridgeService: CrossChainBridgeService,
  ) {}

  @Post('wallet')
  @ApiOperation({ summary: 'Get or create a deposit wallet address' })
  async getDepositAddress(@Request() req, @Body() dto: DepositAddressDto) {
    if (dto.network === BlockchainNetwork.STELLAR) {
      return this.stellarService.getOrCreateWallet(req.user.id);
    }
    return this.ethereumService.getOrCreateWallet(req.user.id);
  }

  @Post('deposit/verify')
  @ApiOperation({ summary: 'Verify an on-chain deposit by transaction hash' })
  async verifyDeposit(@Request() req, @Body() dto: VerifyDepositDto) {
    if (dto.network === BlockchainNetwork.STELLAR) {
      return this.stellarService.verifyDeposit(req.user.id, dto.txHash);
    }
    return this.ethereumService.verifyDeposit(req.user.id, dto.txHash);
  }

  @Post('withdraw')
  @ApiOperation({ summary: 'Withdraw USDC to an external wallet' })
  async withdraw(@Request() req, @Body() dto: WithdrawDto) {
    return this.stellarService.withdraw(
      req.user.id,
      dto.toAddress,
      dto.amount,
      dto.memo,
    );
  }

  @Post('bridge')
  @ApiOperation({ summary: 'Initiate a cross-chain bridge transfer' })
  async bridge(@Request() req, @Body() dto: BridgeTransferDto) {
    const sourceWallet =
      dto.sourceNetwork === BlockchainNetwork.STELLAR
        ? await this.stellarService.getOrCreateWallet(req.user.id)
        : await this.ethereumService.getOrCreateWallet(req.user.id);

    return this.bridgeService.initiateBridge(
      req.user.id,
      dto.sourceNetwork,
      dto.destinationNetwork,
      sourceWallet.address,
      dto.destinationAddress,
      dto.amount,
    );
  }

  @Post('bridge/:id/approve')
  @ApiOperation({ summary: 'Add a multi-sig approval to a bridge operation' })
  async approveBridge(@Param('id') id: string) {
    return this.bridgeService.addApproval(id);
  }

  @Get('bridge/health')
  @ApiOperation({ summary: 'Check bridge fund health and reserve status' })
  async bridgeHealth() {
    return this.bridgeService.getBridgeHealth();
  }

  @Get('bridge/:id')
  @ApiOperation({ summary: 'Get bridge transfer status by ID' })
  async getBridge(@Param('id') id: string) {
    return this.bridgeService.getBridgeById(id);
  }

  @Get('bridge/history')
  @ApiOperation({ summary: 'Get cross-chain bridge history for current user' })
  async bridgeHistory(@Request() req) {
    return this.bridgeService.getBridgeHistory(req.user.id);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Get all blockchain transaction history' })
  async transactions(@Request() req) {
    const [stellar, ethereum] = await Promise.all([
      this.stellarService.getTransactionHistory(req.user.id),
      this.ethereumService.getTransactionHistory(req.user.id),
    ]);
    return [...stellar, ...ethereum].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }
}
