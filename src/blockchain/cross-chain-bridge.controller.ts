import { Controller, Post, Get, Body, Param, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CrossChainBridgeService } from './services/cross-chain-bridge.service';
import { BridgeTransferDto } from './dto/bridge.dto';

@ApiTags('cross-chain-bridge')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bridge')
export class CrossChainBridgeController {
  constructor(private readonly bridgeService: CrossChainBridgeService) {}

  @Post()
  @ApiOperation({ summary: 'Initiate a cross-chain bridge transfer' })
  async initiateBridge(@Request() req, @Body() dto: BridgeTransferDto) {
    return this.bridgeService.initiateBridge(
      req.user.id,
      dto.sourceNetwork,
      dto.destinationNetwork,
      dto.sourceAddress,
      dto.destinationAddress,
      dto.amount,
    );
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Add a multi-sig approval to a bridge operation' })
  async approveBridge(@Param('id') id: string) {
    return this.bridgeService.addApproval(id);
  }

  @Get('health')
  @ApiOperation({ summary: 'Check bridge fund health and reserve status' })
  async bridgeHealth() {
    return this.bridgeService.getBridgeHealth();
  }

  @Get('history')
  @ApiOperation({ summary: 'Get cross-chain bridge history for current user' })
  async bridgeHistory(@Request() req) {
    return this.bridgeService.getBridgeHistory(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get bridge transfer status by ID' })
  async getBridge(@Param('id') id: string) {
    return this.bridgeService.getBridgeById(id);
  }
}
