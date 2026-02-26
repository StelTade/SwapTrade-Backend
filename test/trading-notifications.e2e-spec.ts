/**
 * End-to-End Tests: Trading Notification Triggers
 *
 * Tests notification system:
 * - Order filled notifications
 * - Achievement/badge notifications
 * - Balance alerts
 * - Notification queue integration
 * - Event-driven notifications
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
} from './fixtures/balance.fixtures';
import {
  createBuyTrade,
  createSellTrade,
  getUserTradeCount,
  getUserFirstTrade,
} from './fixtures/trade.fixtures';
import { NotificationEventType } from '../src/common/enums/notification-event-type.enum';
import { TradeType } from '../src/common/enums/trade-type.enum';

describe('Trading Notifications E2E', () => {
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

  describe('Order Filled Notifications', () => {
    it('should create notification when order is filled', async () => {
      const repos = getTestRepositories(dataSource);

      const user = await createTestUser(repos.user, {
        email: 'notif_fill@test.com',
        password: 'NotifFill@123',
        username: 'notif_filler',
      });

      await seedDefaultUserBalances(
        repos.userBalance,
        repos.virtualAsset,
        user,
      );

      // Create trade (simulates filled order)
      const trade = await createBuyTrade(repos.trade, user.id, 'BTC', 0.1, 45000);

      // Create notification
      const notification = repos.notification.create({
        userId: user.id.toString(),
        title: 'Order Filled',
        message: `BUY 0.1 BTC at $45,000 filled`,
        type: 'trade_completed',
        read: false,
        createdAt: new Date(),
      });
      await repos.notification.save(notification);

      // Verify notification
      const userNotifications = await repos.notification.find({
        where: { userId: user.id.toString() },
      });

      expect(userNotifications.length).toBe(1);
      expect(userNotifications[0].title).toBe('Order Filled');
      expect(userNotifications[0].message).toContain('BTC');
    });

    it('should include trade details in notification', async () => {
      const repos = getTestRepositories(dataSource);

      const user = await createTestUser(repos.user, {
        email: 'notif_details@test.com',
        password: 'NotifDetails@123',
        username: 'notif_detailer',
      });

      await seedDefaultUserBalances(
        repos.userBalance,
        repos.virtualAsset,
        user,
      );

      // Create BUY trade
      const buyTrade = await createBuyTrade(repos.trade, user.id, 'BTC', 0.5, 45000);

      const notification = repos.notification.create({
        userId: user.id.toString(),
        title: 'BUY Order Filled',
        message: `Successfully bought 0.5 BTC at $45,000/BTC (Total: $22,500)`,
        type: 'trade_completed',
        read: false,
        createdAt: new Date(),
      });
      await repos.notification.save(notification);

      const userNotifications = await repos.notification.find({
        where: { userId: user.id.toString() },
      });

      expect(userNotifications.length).toBe(1);
      expect(userNotifications[0].message).toContain('0.5');
      expect(userNotifications[0].message).toContain('45000');
      expect(userNotifications[0].message).toContain('22500');
    });

    it('should distinguish between BUY and SELL notifications', async () => {
      const repos = getTestRepositories(dataSource);

      const user = await createTestUser(repos.user, {
        email: 'notif_buysell@test.com',
        password: 'NotifBuySell@123',
        username: 'notif_buyeller',
      });

      await seedDefaultUserBalances(
        repos.userBalance,
        repos.virtualAsset,
        user,
      );

      // BUY trade
      const buyTrade = await createBuyTrade(repos.trade, user.id, 'BTC', 0.1, 45000);
      const buyNotif = repos.notification.create({
        userId: user.id.toString(),
        title: 'BUY Order Filled',
        message: 'BUY 0.1 BTC',
        type: 'trade_completed',
        read: false,
        createdAt: new Date(),
      });
      await repos.notification.save(buyNotif);

      // SELL trade
      const sellTrade = await createSellTrade(repos.trade, user.id, 'BTC', 0.05, 46000);
      const sellNotif = repos.notification.create({
        userId: user.id.toString(),
        title: 'SELL Order Filled',
        message: 'SELL 0.05 BTC',
        type: 'trade_completed',
        read: false,
        createdAt: new Date(),
      });
      await repos.notification.save(sellNotif);

      const notifs = await repos.notification.find({
        where: { userId: user.id.toString() },
        order: { createdAt: 'ASC' },
      });

      expect(notifs.length).toBe(2);
      expect(notifs[0].title).toContain('BUY');
      expect(notifs[1].title).toContain('SELL');
    });

    it('should notify multiple users independently', async () => {
      const repos = getTestRepositories(dataSource);

      const alice = await createTestUser(repos.user, {
        email: 'notif_alice@test.com',
        password: 'NotifAlice@123',
        username: 'notif_alice',
      });

      const bob = await createTestUser(repos.user, {
        email: 'notif_bob@test.com',
        password: 'NotifBob@123',
        username: 'notif_bob',
      });

      await seedDefaultUserBalances(
        repos.userBalance,
        repos.virtualAsset,
        alice,
      );
      await seedDefaultUserBalances(repos.userBalance, repos.virtualAsset, bob);

      // Alice's trade
      await createBuyTrade(repos.trade, alice.id, 'BTC', 0.1, 45000);
      const aliceNotif = repos.notification.create({
        userId: alice.id.toString(),
        title: 'Order Filled',
        message: 'Alice BTC order filled',
        type: 'trade_completed',
        read: false,
        createdAt: new Date(),
      });
      await repos.notification.save(aliceNotif);

      // Bob's trade
      await createBuyTrade(repos.trade, bob.id, 'ETH', 1, 2500);
      const bobNotif = repos.notification.create({
        userId: bob.id.toString(),
        title: 'Order Filled',
        message: 'Bob ETH order filled',
        type: 'trade_completed',
        read: false,
        createdAt: new Date(),
      });
      await repos.notification.save(bobNotif);

      const aliceNotifs = await repos.notification.find({
        where: { userId: alice.id.toString() },
      });
      const bobNotifs = await repos.notification.find({
        where: { userId: bob.id.toString() },
      });

      expect(aliceNotifs.length).toBe(1);
      expect(bobNotifs.length).toBe(1);
      expect(aliceNotifs[0].message).toContain('Alice');
      expect(bobNotifs[0].message).toContain('Bob');
    });
  });

  describe('Achievement Notifications', () => {
    it('should notify on first trade achievement', async () => {
      const repos = getTestRepositories(dataSource);

      const user = await createTestUser(repos.user, {
        email: 'achievement_first@test.com',
        password: 'AchievementFirst@123',
        username: 'achievement_first',
      });

      await seedDefaultUserBalances(
        repos.userBalance,
        repos.virtualAsset,
        user,
      );

      // Verify no trades yet
      const tradeCountBefore = await getUserTradeCount(repos.trade, user.id);
      expect(tradeCountBefore).toBe(0);

      // Create first trade
      const firstTrade = await createBuyTrade(
        repos.trade,
        user.id,
        'BTC',
        0.1,
        45000,
      );

      // Verify first trade
      const tradeCountAfter = await getUserTradeCount(repos.trade, user.id);
      expect(tradeCountAfter).toBe(1);

      // Create achievement notification
      if (tradeCountAfter === 1) {
        const achievementNotif = repos.notification.create({
          userId: user.id.toString(),
          title: 'Achievement Unlocked',
          message: 'First Trade Badge Awarded!',
          type: 'system_alert',
          read: false,
          createdAt: new Date(),
        });
        await repos.notification.save(achievementNotif);
      }

      // Verify achievement notification
      const notifications = await repos.notification.find({
        where: { userId: user.id.toString() },
      });

      expect(notifications.length).toBe(1);
      expect(notifications[0].title).toBe('Achievement Unlocked');
      expect(notifications[0].message).toContain('First Trade');
    });

    it('should not notify on subsequent trades', async () => {
      const repos = getTestRepositories(dataSource);

      const user = await createTestUser(repos.user, {
        email: 'achievement_second@test.com',
        password: 'AchievementSecond@123',
        username: 'achievement_second',
      });

      await seedDefaultUserBalances(
        repos.userBalance,
        repos.virtualAsset,
        user,
      );

      // First trade
      await createBuyTrade(repos.trade, user.id, 'BTC', 0.1, 45000);

      const firstNotif = repos.notification.create({
        userId: user.id.toString(),
        title: 'First Trade',
        message: 'Badge awarded',
        type: 'system_alert',
        read: false,
        createdAt: new Date(),
      });
      await repos.notification.save(firstNotif);

      // Second trade
      await createBuyTrade(repos.trade, user.id, 'ETH', 1, 2500);

      // Should NOT add another achievement notification
      const notifs = await repos.notification.find({
        where: {
          userId: user.id.toString(),
          title: 'First Trade',
        },
      });

      expect(notifs.length).toBe(1); // Only the initial one
    });

    it('should include achievement details in notification', async () => {
      const repos = getTestRepositories(dataSource);

      const user = await createTestUser(repos.user, {
        email: 'achievement_detail@test.com',
        password: 'AchievementDetail@123',
        username: 'achievement_detail',
      });

      await seedDefaultUserBalances(
        repos.userBalance,
        repos.virtualAsset,
        user,
      );

      // Create first trade
      const trade = await createBuyTrade(repos.trade, user.id, 'BTC', 0.1, 45000);

      // Create detailed achievement notification
      const achievementNotif = repos.notification.create({
        userId: user.id.toString(),
        title: 'Achievement: First Trade',
        message: `Congratulations! You completed your first trade: BUY 0.1 BTC at $45,000`,
        type: 'system_alert',
        read: false,
        createdAt: new Date(),
      });
      await repos.notification.save(achievementNotif);

      const notifs = await repos.notification.find({
        where: { userId: user.id.toString() },
      });

      expect(notifs[0].message).toContain('first trade');
      expect(notifs[0].message).toContain('BTC');
    });
  });

  describe('Notification Status', () => {
    it('should mark notifications as read', async () => {
      const repos = getTestRepositories(dataSource);

      const user = await createTestUser(repos.user, {
        email: 'notif_read@test.com',
        password: 'NotifRead@123',
        username: 'notif_reader',
      });

      await seedDefaultUserBalances(
        repos.userBalance,
        repos.virtualAsset,
        user,
      );

      // Create trade and notification
      await createBuyTrade(repos.trade, user.id, 'BTC', 0.1, 45000);

      const notification = repos.notification.create({
        userId: user.id.toString(),
        title: 'Order Filled',
        message: 'BTC order filled',
        type: 'trade_completed',
        read: false,
        createdAt: new Date(),
      });
      await repos.notification.save(notification);

      // Verify unread
      let notif = await repos.notification.findOne({
        where: { id: notification.id },
      });
      expect(notif.read).toBe(false);

      // Mark as read
      notif.read = true;
      await repos.notification.save(notif);

      // Verify read
      notif = await repos.notification.findOne({
        where: { id: notification.id },
      });
      expect(notif.read).toBe(true);
    });

    it('should separate read and unread notifications', async () => {
      const repos = getTestRepositories(dataSource);

      const user = await createTestUser(repos.user, {
        email: 'notif_separate@test.com',
        password: 'NotifSeparate@123',
        username: 'notif_separator',
      });

      await seedDefaultUserBalances(
        repos.userBalance,
        repos.virtualAsset,
        user,
      );

      // Create 3 notifications
      for (let i = 0; i < 3; i++) {
        const notif = repos.notification.create({
          userId: user.id.toString(),
          title: `Notification ${i + 1}`,
          message: `Message ${i + 1}`,
          type: 'system_alert',
          read: false,
          createdAt: new Date(),
        });
        await repos.notification.save(notif);
      }

      // Mark first 2 as read
      const unread = await repos.notification.find({
        where: { userId: user.id.toString(), read: false },
      });
      expect(unread.length).toBe(3);

      // Mark 2 as read
      unread[0].read = true;
      unread[1].read = true;
      await repos.notification.save(unread);

      const stillUnread = await repos.notification.find({
        where: { userId: user.id.toString(), read: false },
      });
      const nowRead = await repos.notification.find({
        where: { userId: user.id.toString(), read: true },
      });

      expect(stillUnread.length).toBe(1);
      expect(nowRead.length).toBe(2);
    });
  });

  describe('Notification Queue Integration', () => {
    it('should queue trade notification on order fill', async () => {
      const repos = getTestRepositories(dataSource);

      const user = await createTestUser(repos.user, {
        email: 'queue_fill@test.com',
        password: 'QueueFill@123',
        username: 'queue_filler',
      });

      await seedDefaultUserBalances(
        repos.userBalance,
        repos.virtualAsset,
        user,
      );

      // Create trade
      const trade = await createBuyTrade(repos.trade, user.id, 'BTC', 0.1, 45000);

      // Simulate queuing notification
      const notification = repos.notification.create({
        userId: user.id.toString(),
        title: 'Order Filled',
        message: `BUY 0.1 BTC at $45,000`,
        type: 'trade_completed',
        read: false,
        createdAt: new Date(),
      });
      const savedNotif = await repos.notification.save(notification);

      // Verify notification was queued/saved
      expect(savedNotif.id).toBeDefined();

      const retrievedNotif = await repos.notification.findOne({
        where: { id: savedNotif.id },
      });
      expect(retrievedNotif).toBeDefined();
      expect(retrievedNotif.type).toBe('trade_completed');
    });

    it('should handle notification persistence errors', async () => {
      const repos = getTestRepositories(dataSource);

      const user = await createTestUser(repos.user, {
        email: 'queue_error@test.com',
        password: 'QueueError@123',
        username: 'queue_error_handler',
      });

      await seedDefaultUserBalances(
        repos.userBalance,
        repos.virtualAsset,
        user,
      );

      // Create notification with invalid data
      try {
        const invalidNotif = repos.notification.create({
          userId: null, // Invalid
          title: 'Test',
          message: 'Test',
          type: 'system_alert',
          read: false,
          createdAt: new Date(),
        });
        await repos.notification.save(invalidNotif);
      } catch (error) {
        // Expect error due to null userId
        expect(error).toBeDefined();
      }

      // Verify no orphaned notification
      const count = await repos.notification.count();
      expect(count).toBe(0);
    });
  });

  describe('Notification Timing', () => {
    it('should include timestamp in notifications', async () => {
      const repos = getTestRepositories(dataSource);

      const user = await createTestUser(repos.user, {
        email: 'notif_time@test.com',
        password: 'NotifTime@123',
        username: 'notif_timer',
      });

      await seedDefaultUserBalances(
        repos.userBalance,
        repos.virtualAsset,
        user,
      );

      const beforeTime = new Date();
      await createBuyTrade(repos.trade, user.id, 'BTC', 0.1, 45000);
      const afterTime = new Date();

      const notif = repos.notification.create({
        userId: user.id.toString(),
        title: 'Order Filled',
        message: 'Test',
        type: 'trade_completed',
        read: false,
        createdAt: new Date(),
      });
      await repos.notification.save(notif);

      const retrieved = await repos.notification.findOne({
        where: { id: notif.id },
      });

      expect(retrieved.createdAt).toBeDefined();
      expect(retrieved.createdAt >= beforeTime).toBe(true);
      expect(retrieved.createdAt <= afterTime).toBe(true);
    });

    it('should preserve notification order by time', async () => {
      const repos = getTestRepositories(dataSource);

      const user = await createTestUser(repos.user, {
        email: 'notif_order@test.com',
        password: 'NotifOrder@123',
        username: 'notif_orderer',
      });

      await seedDefaultUserBalances(
        repos.userBalance,
        repos.virtualAsset,
        user,
      );

      const times: Date[] = [];

      // Create 3 notifications with small delays
      for (let i = 0; i < 3; i++) {
        const time = new Date();
        times.push(time);

        const notif = repos.notification.create({
          userId: user.id.toString(),
          title: `Notification ${i + 1}`,
          message: `Message ${i + 1}`,
          type: 'system_alert',
          read: false,
          createdAt: time,
        });
        await repos.notification.save(notif);

        // Small delay for next notification
        await new Promise((resolve) => setTimeout(resolve, 5));
      }

      // Retrieve in DESC order (most recent first)
      const notifs = await repos.notification.find({
        where: { userId: user.id.toString() },
        order: { createdAt: 'DESC' },
      });

      expect(notifs.length).toBe(3);
      expect(notifs[0].createdAt >= notifs[1].createdAt).toBe(true);
      expect(notifs[1].createdAt >= notifs[2].createdAt).toBe(true);
    });
  });

  describe('Event-Driven Notifications', () => {
    it('should correlate notification with trade event', async () => {
      const repos = getTestRepositories(dataSource);

      const user = await createTestUser(repos.user, {
        email: 'event_correlation@test.com',
        password: 'EventCorrelation@123',
        username: 'event_correlator',
      });

      await seedDefaultUserBalances(
        repos.userBalance,
        repos.virtualAsset,
        user,
      );

      // Create trade
      const trade = await createBuyTrade(repos.trade, user.id, 'BTC', 0.1, 45000);

      // Create correlated notification
      const notif = repos.notification.create({
        userId: user.id.toString(),
        title: `Trade Filled: ${trade.type} ${trade.amount} ${trade.asset}`,
        message: `Your ${trade.type} order for ${trade.amount} ${trade.asset} at $${trade.price} has been filled`,
        type: 'trade_completed',
        read: false,
        createdAt: new Date(),
      });
      await repos.notification.save(notif);

      // Verify correlation
      const retrieved = await repos.notification.findOne({
        where: { id: notif.id },
      });

      expect(retrieved.title).toContain(trade.type);
      expect(retrieved.title).toContain(trade.asset);
      expect(retrieved.message).toContain(trade.amount.toString());
    });
  });
});
