import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CrossChainBridge } from './entities/cross-chain-bridge.entity';
import { CrossChainBridgeService } from './services/cross-chain-bridge.service';
import { CrossChainBridgeController } from './cross-chain-bridge.controller';
import { BlockchainModule } from './blockchain.module';

@Module({
  imports: [TypeOrmModule.forFeature([CrossChainBridge]), BlockchainModule],
  controllers: [CrossChainBridgeController],
  providers: [CrossChainBridgeService],
  exports: [CrossChainBridgeService],
})
export class CrossChainBridgeModule {}
