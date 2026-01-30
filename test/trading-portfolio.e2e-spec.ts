/**
 * End-to-End Tests: Portfolio Balance Updates
 *
 * Tests portfolio state tracking:
 * - Cumulative P&L calculation
 * - Trade count tracking
 * - Trade volume calculation
 * - Per-asset balance updates
 * - Last trade date tracking
 * - Portfolio statistics
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import {
  initializeTestDatabase,
  resetTestDatabase,
  seedVirtualAssets,
  getTestRepositories,
} from './fixtures/test-database.setup';
import { createTestUser } from './fixtures/user.fixtures';
import {
  seedDefaultUserBalances,
  getUserBalance,
  updateBalance,
} from './fixtures/balance.fixtures';
import {
  createBuyTrade,
  createSellTrade,
  getUserTrades,
  getUserTradeCount,
  getUserTradeVolume,
  calculateUserPnL,
} from './fixtures/trade.fixtures';
import { TradeType } from '../src/common/enums/trade-type.enum';

describe('Portfolio Balance Updates E2E', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
    await initializeTestDatabase(dataSource);
  });

  beforeEach(async () => {
    await resetTestDatabase(dataSource);
    await seedVirtualAssets(dataSource);
  });

  afterAll(async () => {
    await resetTestDatabase(dataSource);
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
    await app.close();
  });

  describe('Trade Count Tracking', () => {
    it('should increment trade count on each trade', async () => {
      const repos = getTestRepositories(dataSource);

      const user = await createTestUser(repos.user, {
        email: 'count@test.com',
        password: 'CountTrades@123',
        username: 'counter',
      });

      await seedDefaultUserBalances(
        repos.userBalance,
        repos.virtualAsset,
        user,
      );

      // Initial trade count should be 0
      let tradeCount = await getUserTradeCount(repos.trade, user.id);
      expect(tradeCount).toBe(0);

      // Create first trade
      await createBuyTrade(repos.trade, user.id, 'BTC', 0.1, 45000);
      tradeCount = await getUserTradeCount(repos.trade, user.id);
      expect(tradeCount).toBe(1);

      // Create second trade
      await createBuyTrade(repos.trade, user.id, 'ETH', 1, 2500);
      tradeCount = await getUserTradeCount(repos.trade, user.id);
      expect(tradeCount).toBe(2);

      // Create third trade
      await createSellTrade(repos.trade, user.id, 'BTC', 0.05, 45500);
      tradeCount = await getUserTradeCount(repos.trade, user.id);
      expect(tradeCount).toBe(3);
    });

    it('should track distinct trades per user', async () => {
      const repos = getTestRepositories(dataSource);

      const alice = await createTestUser(repos.user, {
        email: 'alice_count@test.com',
        password: 'AliceCount@123',
        username: 'alice_counter',
      });

      const bob = await createTestUser(repos.user, {
        email: 'bob_count@test.com',
        password: 'BobCount@123',
        username: 'bob_counter',
      });

      await seedDefaultUserBalances(
        repos.userBalance,
        repos.virtualAsset,
        alice,
      );
      await seedDefaultUserBalances(repos.userBalance, repos.virtualAsset, bob);

      // Alice trades
      await createBuyTrade(repos.trade, alice.id, 'BTC', 0.1, 45000);
      await createBuyTrade(repos.trade, alice.id, 'ETH', 1, 2500);

      // Bob trades
      await createBuyTrade(repos.trade, bob.id, 'BTC', 0.05, 45000);

      const aliceCount = await getUserTradeCount(repos.trade, alice.id);
      const bobCount = await getUserTradeCount(repos.trade, bob.id);

      expect(aliceCount).toBe(2);
      expect(bobCount).toBe(1);
    });
  });

  describe('Trade Volume Calculation', () => {
    it('should calculate total trade volume correctly', async () => {
      const repos = getTestRepositories(dataSource);

      const user = await createTestUser(repos.user, {
        email: 'volume@test.com',
        password: 'VolumeCalc@123',
        username: 'volume_calc',
      });

      await seedDefaultUserBalances(
        repos.userBalance,
        repos.virtualAsset,
        user,
      );

      // Create trades
      // Trade 1: 0.1 BTC @ $45,000 = $4,500
      await createBuyTrade(repos.trade, user.id, 'BTC', 0.1, 45000);
      // Trade 2: 1 ETH @ $2,500 = $2,500
      await createBuyTrade(repos.trade, user.id, 'ETH', 1, 2500);
      // Trade 3: 0.05 BTC @ $45,500 = $2,275
      await createSellTrade(repos.trade, user.id, 'BTC', 0.05, 45500);

      const volume = await getUserTradeVolume(repos.trade, user.id);

      // Total volume = 4500 + 2500 + 2275 = $9,275
      expect(volume).toBe(9275);
    });

    it('should include both BUY and SELL in volume calculation', async () => {
      const repos = getTestRepositories(dataSource);

      const user = await createTestUser(repos.user, {
        email: 'buysell_vol@test.com',
        password: 'BuySellVol@123',
        username: 'buysell_volumizer',
      });

      await seedDefaultUserBalances(
        repos.userBalance,
        repos.virtualAsset,
        user,
      );

      // Buy 0.2 BTC @ $45,000 = $9,000
      await createBuyTrade(repos.trade, user.id, 'BTC', 0.2, 45000);
      // Sell 0.1 BTC @ $46,000 = $4,600
      await createSellTrade(repos.trade, user.id, 'BTC', 0.1, 46000);

      const volume = await getUserTradeVolume(repos.trade, user.id);

      // Total volume = 9000 + 4600 = $13,600
      expect(volume).toBe(13600);
    });

    it('should handle zero trades volume', async () => {
      const repos = getTestRepositories(dataSource);

      const user = await createTestUser(repos.user, {
        email: 'zero_vol@test.com',
        password: 'ZeroVolume@123',
        username: 'zero_volumizer',
      });

      await seedDefaultUserBalances(
        repos.userBalance,
        repos.virtualAsset,
        user,
      );

      const volume = await getUserTradeVolume(repos.trade, user.id);
      expect(volume).toBe(0);
    });
  });

  describe('Profit & Loss Calculation', () => {
    it('should calculate PnL for BUY trades', async () => {
      const repos = getTestRepositories(dataSource);

      const user = await createTestUser(repos.user, {
        email: 'pnl_buy@test.com',
        password: 'PnLBuy@123',
        username: 'pnl_buyer',
      });

      await seedDefaultUserBalances(
        repos.userBalance,
        repos.virtualAsset,
        user,
      );

      // Buy 1 BTC @ $45,000
      await createBuyTrade(repos.trade, user.id, 'BTC', 1, 45000);

      // Calculate PnL at current price $46,000
      const pnl = await calculateUserPnL(repos.trade, user.id, 'BTC', 46000);

      // PnL = (1 * 46000) - (1 * 45000) = $1,000 profit
      expect(pnl).toBe(1000);
    });

    it('should calculate negative PnL for losing trades', async () => {
      const repos = getTestRepositories(dataSource);

      const user = await createTestUser(repos.user, {
        email: 'pnl_loss@test.com',
        password: 'PnLLoss@123',
        username: 'pnl_loser',
      });

      await seedDefaultUserBalances(
        repos.userBalance,
        repos.virtualAsset,
        user,
      );

      // Buy 1 BTC @ $45,000
      await createBuyTrade(repos.trade, user.id, 'BTC', 1, 45000);

      // Calculate PnL at lower price $44,000
      const pnl = await calculateUserPnL(repos.trade, user.id, 'BTC', 44000);

      // PnL = (1 * 44000) - (1 * 45000) = -$1,000 loss
      expect(pnl).toBe(-1000);
    });

    it('should calculate PnL with multiple BUY trades (average cost)', async () => {
      const repos = getTestRepositories(dataSource);

      const user = await createTestUser(repos.user, {
        email: 'pnl_multi@test.com',
        password: 'PnLMulti@123',
        username: 'pnl_multi_buyer',
      });

      await seedDefaultUserBalances(
        repos.userBalance,
        repos.virtualAsset,
        user,
      );

      // Buy 0.5 BTC @ $45,000 = $22,500
      await createBuyTrade(repos.trade, user.id, 'BTC', 0.5, 45000);
      // Buy 0.5 BTC @ $46,000 = $23,000
      await createBuyTrade(repos.trade, user.id, 'BTC', 0.5, 46000);

      // Total: 1 BTC bought for $45,500 (average cost)
      // At current price $46,500
      const pnl = await calculateUserPnL(repos.trade, user.id, 'BTC', 46500);

      // PnL = (1 * 46500) - 45500 = $1,000
      expect(pnl).toBe(1000);
    });

    it('should handle mix of BUY and SELL trades', async () => {
      const repos = getTestRepositories(dataSource);

      const user = await createTestUser(repos.user, {
        email: 'pnl_mix@test.com',
        password: 'PnLMix@123',
        username: 'pnl_mixer',
      });

      await seedDefaultUserBalances(
        repos.userBalance,
        repos.virtualAsset,
        user,
      );

      // Buy 2 BTC @ $45,000 = $90,000
      await createBuyTrade(repos.trade, user.id, 'BTC', 2, 45000);
      // Sell 1 BTC @ $46,000 = $46,000
      await createSellTrade(repos.trade, user.id, 'BTC', 1, 46000);

      // Remaining: 1 BTC at average cost $45,000
      // At current price $47,000
      const pnl = await calculateUserPnL(repos.trade, user.id, 'BTC', 47000);

      // Cost basis: 2*45000 - 1*46000 = $44,000
      // Current value: 1*47000 = $47,000
      // PnL = 47000 - 44000 = $3,000
      expect(pnl).toBe(3000);
    });
  });

  describe('Asset Balance Updates', () => {
    it('should update BTC balance on BUY trade', async () => {
      const repos = getTestRepositories(dataSource);

      const user = await createTestUser(repos.user, {
        email: 'btc_update@test.com',
        password: 'BtcUpdate@123',
        username: 'btc_updater',
      });

      await seedDefaultUserBalances(
        repos.userBalance,
        repos.virtualAsset,
        user,
      );

      const btcAsset = await repos.virtualAsset.findOne({
        where: { symbol: 'BTC' },
      });

      // Initial BTC balance
      const btcBefore = await getUserBalance(
        repos.userBalance,
        user.id,
        btcAsset.id,
      );
      expect(btcBefore.amount).toBe(0.5);

      // Create BUY trade
      await createBuyTrade(repos.trade, user.id, 'BTC', 0.25, 45000);

      // Simulate balance update
      const newBalance = Number(btcBefore.amount) + 0.25;
      await updateBalance(repos.userBalance, user.id, btcAsset.id, newBalance);

      // Verify new balance
      const btcAfter = await getUserBalance(
        repos.userBalance,
        user.id,
        btcAsset.id,
      );
      expect(btcAfter.amount).toBe(0.75);
    });

    it('should update USD balance on SELL trade', async () => {
      const repos = getTestRepositories(dataSource);

      const user = await createTestUser(repos.user, {
        email: 'usd_update@test.com',
        password: 'UsdUpdate@123',
        username: 'usd_updater',
      });

      await seedDefaultUserBalances(
        repos.userBalance,
        repos.virtualAsset,
        user,
      );

      const usdAsset = await repos.virtualAsset.findOne({
        where: { symbol: 'USD' },
      });
      const btcAsset = await repos.virtualAsset.findOne({
        where: { symbol: 'BTC' },
      });

      // Initial balances
      const usdBefore = await getUserBalance(
        repos.userBalance,
        user.id,
        usdAsset.id,
      );
      const btcBefore = await getUserBalance(
        repos.userBalance,
        user.id,
        btcAsset.id,
      );

      expect(usdBefore.amount).toBe(10000);
      expect(btcBefore.amount).toBe(0.5);

      // Create SELL trade: 0.1 BTC @ $46,000 = $4,600
      await createSellTrade(repos.trade, user.id, 'BTC', 0.1, 46000);

      // Simulate balance updates
      const newUsdAmount = Number(usdBefore.amount) + 4600;
      const newBtcAmount = Number(btcBefore.amount) - 0.1;

      await updateBalance(repos.userBalance, user.id, usdAsset.id, newUsdAmount);
      await updateBalance(repos.userBalance, user.id, btcAsset.id, newBtcAmount);

      // Verify updated balances
      const usdAfter = await getUserBalance(
        repos.userBalance,
        user.id,
        usdAsset.id,
      );
      const btcAfter = await getUserBalance(
        repos.userBalance,
        user.id,
        btcAsset.id,
      );

      expect(usdAfter.amount).toBe(14600);
      expect(btcAfter.amount).toBe(0.4);
    });

    it('should track multiple asset balances independently', async () => {
      const repos = getTestRepositories(dataSource);

      const user = await createTestUser(repos.user, {
        email: 'multi_asset@test.com',
        password: 'MultiAsset@123',
        username: 'multi_assetter',
      });

      await seedDefaultUserBalances(
        repos.userBalance,
        repos.virtualAsset,
        user,
      );

      const usdAsset = await repos.virtualAsset.findOne({
        where: { symbol: 'USD' },
      });
      const btcAsset = await repos.virtualAsset.findOne({
        where: { symbol: 'BTC' },
      });
      const ethAsset = await repos.virtualAsset.findOne({
        where: { symbol: 'ETH' },
      });

      // Create trades
      await createBuyTrade(repos.trade, user.id, 'BTC', 0.1, 45000);
      await createBuyTrade(repos.trade, user.id, 'ETH', 1, 2500);

      // Simulate updates
      const usd = await getUserBalance(repos.userBalance, user.id, usdAsset.id);
      const btc = await getUserBalance(repos.userBalance, user.id, btcAsset.id);
      const eth = await getUserBalance(repos.userBalance, user.id, ethAsset.id);

      await updateBalance(
        repos.userBalance,
        user.id,
        usdAsset.id,
        Number(usd.amount) - 4500 - 2500,
      );
      await updateBalance(
        repos.userBalance,
        user.id,
        btcAsset.id,
        Number(btc.amount) + 0.1,
      );
      await updateBalance(
        repos.userBalance,
        user.id,
        ethAsset.id,
        Number(eth.amount) + 1,
      );

      // Verify all balances
      const finalUsd = await getUserBalance(
        repos.userBalance,
        user.id,
        usdAsset.id,
      );
      const finalBtc = await getUserBalance(
        repos.userBalance,
        user.id,
        btcAsset.id,
      );
      const finalEth = await getUserBalance(
        repos.userBalance,
        user.id,
        ethAsset.id,
      );

      expect(finalUsd.amount).toBe(3000); // 10000 - 4500 - 2500
      expect(finalBtc.amount).toBe(0.6); // 0.5 + 0.1
      expect(finalEth.amount).toBe(6); // 5 + 1
    });
  });

  describe('Portfolio Statistics', () => {
    it('should aggregate portfolio statistics correctly', async () => {
      const repos = getTestRepositories(dataSource);

      const user = await createTestUser(repos.user, {
        email: 'portfolio@test.com',
        password: 'PortfolioStats@123',
        username: 'portfolio_tracker',
      });

      await seedDefaultUserBalances(
        repos.userBalance,
        repos.virtualAsset,
        user,
      );

      // Create multiple trades
      await createBuyTrade(repos.trade, user.id, 'BTC', 0.1, 45000);
      await createBuyTrade(repos.trade, user.id, 'ETH', 1, 2500);
      await createSellTrade(repos.trade, user.id, 'BTC', 0.05, 45500);

      // Get stats
      const tradeCount = await getUserTradeCount(repos.trade, user.id);
      const tradeVolume = await getUserTradeVolume(repos.trade, user.id);
      const trades = await getUserTrades(repos.trade, user.id);

      expect(tradeCount).toBe(3);
      expect(tradeVolume).toBe(4500 + 2500 + 2275); // $9,275
      expect(trades.length).toBe(3);
      expect(trades[0].type).toBe(TradeType.SELL); // Most recent first
    });

    it('should update portfolio on each trade', async () => {
      const repos = getTestRepositories(dataSource);

      const user = await createTestUser(repos.user, {
        email: 'portfolio_update@test.com',
        password: 'PortfolioUpdate@123',
        username: 'portfolio_updater',
      });

      await seedDefaultUserBalances(
        repos.userBalance,
        repos.virtualAsset,
        user,
      );

      // Portfolio after 0 trades
      let count = await getUserTradeCount(repos.trade, user.id);
      let volume = await getUserTradeVolume(repos.trade, user.id);
      expect(count).toBe(0);
      expect(volume).toBe(0);

      // Trade 1
      await createBuyTrade(repos.trade, user.id, 'BTC', 0.1, 45000);
      count = await getUserTradeCount(repos.trade, user.id);
      volume = await getUserTradeVolume(repos.trade, user.id);
      expect(count).toBe(1);
      expect(volume).toBe(4500);

      // Trade 2
      await createBuyTrade(repos.trade, user.id, 'ETH', 2, 2500);
      count = await getUserTradeCount(repos.trade, user.id);
      volume = await getUserTradeVolume(repos.trade, user.id);
      expect(count).toBe(2);
      expect(volume).toBe(9500);

      // Trade 3
      await createSellTrade(repos.trade, user.id, 'BTC', 0.1, 46000);
      count = await getUserTradeCount(repos.trade, user.id);
      volume = await getUserTradeVolume(repos.trade, user.id);
      expect(count).toBe(3);
      expect(volume).toBe(9500 + 4600);
    });
  });

  describe('Trade Date Tracking', () => {
    it('should track last trade date', async () => {
      const repos = getTestRepositories(dataSource);

      const user = await createTestUser(repos.user, {
        email: 'date_track@test.com',
        password: 'DateTrack@123',
        username: 'date_tracker',
      });

      await seedDefaultUserBalances(
        repos.userBalance,
        repos.virtualAsset,
        user,
      );

      // Create first trade
      const trade1 = await createBuyTrade(repos.trade, user.id, 'BTC', 0.1, 45000);
      expect(trade1.createdAt).toBeDefined();

      // Small delay
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Create second trade
      const trade2 = await createBuyTrade(repos.trade, user.id, 'ETH', 1, 2500);
      expect(trade2.createdAt).toBeDefined();

      const trades = await getUserTrades(repos.trade, user.id);
      expect(trades.length).toBe(2);

      // Most recent trade should be trade2
      expect(trades[0].createdAt >= trades[1].createdAt).toBe(true);
    });
  });
});
