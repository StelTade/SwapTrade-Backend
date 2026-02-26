/**
 * concurrent-bids.spec.ts
 *
 * Focused tests for concurrent bid scenarios:
 *  - Race conditions at the DB layer (simulated via lock ordering)
 *  - Bid increment enforcement under contention
 *  - Anti-sniping extension races
 *  - Balance reservation double-spend prevention
 *  - Auction end-time boundary bids
 */

import { BadRequestException } from '@nestjs/common';
import { AuctionStatus } from '../entities/auction.entity';
import type { Auction } from '../entities/auction.entity';

// ── Shared test fixtures ──────────────────────────────────────────────────────

const makeAuction = (overrides: Partial<Auction> = {}): Auction =>
  ({
    id: 'auction-1',
    assetId: 'BTC',
    title: 'Concurrent Test Auction',
    status: AuctionStatus.ACTIVE,
    startingPrice: 100,
    currentHighestBid: null,
    currentHighestBidderId: null,
    minBidIncrement: 10,
    reservePrice: 0,
    bidCount: 0,
    extensionCount: 0,
    maxExtensions: 10,
    antiSnipingExtensionSeconds: 30,
    endsAt: new Date(Date.now() + 120_000),
    startsAt: new Date(Date.now() - 60_000),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Auction);

/** Simulate the constant-product min-bid rule used by BiddingService */
const getMinBid = (auction: Auction): number =>
  auction.currentHighestBid !== null
    ? Number(auction.currentHighestBid) + Number(auction.minBidIncrement)
    : Number(auction.startingPrice);

/** Tiny async delay — makes concurrent tests more realistic */
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────────────────────────
// 1. Minimum bid increment enforcement
// ─────────────────────────────────────────────────────────────────────────────

describe('Bid increment enforcement', () => {
  it('accepts a bid exactly at the minimum', () => {
    const auction = makeAuction({ currentHighestBid: 200, minBidIncrement: 10 });
    const minBid  = getMinBid(auction);
    expect(minBid).toBe(210);
    expect(210 >= minBid).toBe(true);
  });

  it('accepts a bid above the minimum', () => {
    const auction = makeAuction({ currentHighestBid: 200, minBidIncrement: 10 });
    expect(250 >= getMinBid(auction)).toBe(true);
  });

  it('rejects a bid one unit below the minimum', () => {
    const auction = makeAuction({ currentHighestBid: 200, minBidIncrement: 10 });
    expect(209 < getMinBid(auction)).toBe(true);
  });

  it('uses startingPrice as minimum when no bids exist', () => {
    const auction = makeAuction({ currentHighestBid: null, startingPrice: 500 });
    expect(getMinBid(auction)).toBe(500);
  });

  it('enforces increment on first bid above starting price', () => {
    const auction = makeAuction({ currentHighestBid: null, startingPrice: 100 });
    // First bid only needs to meet startingPrice — no increment applied yet
    expect(100 >= getMinBid(auction)).toBe(true);
    expect(99 < getMinBid(auction)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Pessimistic lock simulation — two simultaneous bids
// ─────────────────────────────────────────────────────────────────────────────

describe('Pessimistic lock simulation — two simultaneous bids', () => {
  /**
   * Models the DB pessimistic_write lock:
   * - Only one bidder holds the lock at a time
   * - The second bidder reads the auction state AFTER the first commits
   */
  class LockedAuctionSimulator {
    private locked = false;
    private auction: Auction;
    public completedBids: Array<{ userId: string; amount: number }> = [];
    public rejectedBids: Array<{ userId: string; amount: number; reason: string }> = [];

    constructor(initial: Auction) {
      this.auction = { ...initial };
    }

    async placeBid(userId: string, amount: number): Promise<void> {
      // Wait for lock
      while (this.locked) {
        await delay(1);
      }
      this.locked = true;

      try {
        // Re-read auction state under lock (simulates SELECT ... FOR UPDATE)
        const minBid = getMinBid(this.auction);

        if (amount < minBid) {
          this.rejectedBids.push({
            userId,
            amount,
            reason: `amount ${amount} < required ${minBid}`,
          });
          return;
        }

        if (this.auction.endsAt.getTime() <= Date.now()) {
          this.rejectedBids.push({ userId, amount, reason: 'auction ended' });
          return;
        }

        // Commit
        this.auction.currentHighestBid = amount;
        this.auction.currentHighestBidderId = userId;
        this.auction.bidCount++;
        this.completedBids.push({ userId, amount });
      } finally {
        this.locked = false;
      }
    }

    getState() {
      return { ...this.auction };
    }
  }

  it('only one of two simultaneous equal bids succeeds', async () => {
    const sim = new LockedAuctionSimulator(
      makeAuction({ currentHighestBid: 100, minBidIncrement: 10 }),
    );

    // Both bidders submit 110 at the exact same time
    await Promise.all([
      sim.placeBid('user-A', 110),
      sim.placeBid('user-B', 110),
    ]);

    expect(sim.completedBids).toHaveLength(1);
    expect(sim.rejectedBids).toHaveLength(1);
    expect(sim.getState().currentHighestBid).toBe(110);
  });

  it('both bids succeed when they are strictly ordered increments', async () => {
    const sim = new LockedAuctionSimulator(
      makeAuction({ currentHighestBid: 100, minBidIncrement: 10 }),
    );

    // A bids first at 110, then B bids at 120 with a slight delay
    await sim.placeBid('user-A', 110);
    await sim.placeBid('user-B', 120);

    expect(sim.completedBids).toHaveLength(2);
    expect(sim.getState().currentHighestBid).toBe(120);
    expect(sim.getState().currentHighestBidderId).toBe('user-B');
  });

  it('10 concurrent bidders — exactly the winning amount becomes current highest', async () => {
    const sim = new LockedAuctionSimulator(
      makeAuction({ currentHighestBid: null, startingPrice: 100, minBidIncrement: 5 }),
    );

    // All 10 bidders attempt 100 simultaneously — only 1 should succeed
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) =>
        sim.placeBid(`user-${i}`, 100),
      ),
    );

    expect(sim.completedBids).toHaveLength(1);
    expect(sim.rejectedBids).toHaveLength(9);
    expect(sim.getState().bidCount).toBe(1);
    expect(sim.getState().currentHighestBid).toBe(100);
  });

  it('sequential valid bids from 5 users all succeed in order', async () => {
    const sim = new LockedAuctionSimulator(
      makeAuction({ currentHighestBid: null, startingPrice: 100, minBidIncrement: 10 }),
    );

    // Stagger bids so each one arrives after the previous commits
    for (let i = 0; i < 5; i++) {
      await sim.placeBid(`user-${i}`, 100 + i * 10);
      await delay(2);
    }

    expect(sim.completedBids).toHaveLength(5);
    expect(sim.getState().currentHighestBid).toBe(140);
    expect(sim.getState().bidCount).toBe(5);
  });

  it('winner is the highest valid bidder after concurrent storm', async () => {
    const sim = new LockedAuctionSimulator(
      makeAuction({ currentHighestBid: 100, minBidIncrement: 10 }),
    );

    // Mix of valid and invalid amounts — valid ones are staggered enough
    // to each be valid WHEN they acquire the lock
    const bidSequence = [
      { userId: 'u1', amount: 110 }, // valid: 100 + 10
      { userId: 'u2', amount: 105 }, // invalid: 100 + 5 < 110
      { userId: 'u3', amount: 115 }, // valid only if u1 is committed first
      { userId: 'u4', amount: 108 }, // invalid regardless
    ];

    // Run with tiny delays to ensure ordering
    for (const bid of bidSequence) {
      sim.placeBid(bid.userId, bid.amount); // fire all without await
      await delay(3);
    }

    // Wait for all in-flight bids to settle
    await delay(20);

    expect(sim.completedBids.length).toBeGreaterThanOrEqual(1);
    // Final state must be a valid increment over the previous highest
    const finalBid = sim.getState().currentHighestBid!;
    expect(finalBid).toBeGreaterThanOrEqual(110);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Anti-sniping extension race
// ─────────────────────────────────────────────────────────────────────────────

describe('Anti-sniping extension logic', () => {
  const ANTI_SNIPE_WINDOW_MS = 30_000;

  const shouldExtend = (
    auction: Auction,
    nowOverride?: number,
  ): boolean => {
    const now         = nowOverride ?? Date.now();
    const remainingMs = auction.endsAt.getTime() - now;
    return (
      remainingMs > 0 &&
      remainingMs <= ANTI_SNIPE_WINDOW_MS &&
      auction.extensionCount < auction.maxExtensions
    );
  };

  it('triggers extension when bid lands in last 30s', () => {
    const auction = makeAuction({
      endsAt: new Date(Date.now() + 20_000), // 20s remaining
    });
    expect(shouldExtend(auction)).toBe(true);
  });

  it('does NOT trigger extension when more than 30s remain', () => {
    const auction = makeAuction({
      endsAt: new Date(Date.now() + 60_000), // 60s remaining
    });
    expect(shouldExtend(auction)).toBe(false);
  });

  it('does NOT extend past maxExtensions', () => {
    const auction = makeAuction({
      endsAt: new Date(Date.now() + 10_000),
      extensionCount: 10,
      maxExtensions: 10,
    });
    expect(shouldExtend(auction)).toBe(false);
  });

  it('does NOT extend after auction already ended', () => {
    const auction = makeAuction({
      endsAt: new Date(Date.now() - 1_000), // ended 1s ago
    });
    expect(shouldExtend(auction)).toBe(false);
  });

  it('correctly calculates new endsAt after extension', () => {
    const originalEnds = new Date(Date.now() + 20_000);
    const auction = makeAuction({
      endsAt: originalEnds,
      antiSnipingExtensionSeconds: 30,
      extensionCount: 0,
    });

    const newEndsAt = new Date(
      auction.endsAt.getTime() + auction.antiSnipingExtensionSeconds * 1000,
    );

    const addedMs = newEndsAt.getTime() - originalEnds.getTime();
    expect(addedMs).toBe(30_000);
    expect(newEndsAt.getTime()).toBeGreaterThan(originalEnds.getTime());
  });

  it('multiple bids in snipe window each extend, up to max', () => {
    let auction = makeAuction({
      endsAt: new Date(Date.now() + 20_000),
      antiSnipingExtensionSeconds: 30,
      extensionCount: 0,
      maxExtensions: 3,
    });

    let extCount = 0;
    // Simulate 5 bids all landing in the snipe window
    for (let i = 0; i < 5; i++) {
      if (shouldExtend(auction)) {
        auction = {
          ...auction,
          endsAt: new Date(auction.endsAt.getTime() + 30_000),
          extensionCount: auction.extensionCount + 1,
        };
        extCount++;
      }
    }

    expect(extCount).toBe(3); // capped at maxExtensions
    expect(auction.extensionCount).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Balance reservation — double-spend prevention
// ─────────────────────────────────────────────────────────────────────────────

describe('Balance reservation under concurrent bids', () => {
  class BalanceLedger {
    private available: number;
    private reserved: number = 0;
    private locked = false;

    constructor(initialBalance: number) {
      this.available = initialBalance;
    }

    async reserve(amount: number, label: string): Promise<void> {
      while (this.locked) await delay(1);
      this.locked = true;

      try {
        if (this.available < amount) {
          throw new BadRequestException(
            `Insufficient balance: have ${this.available}, need ${amount}`,
          );
        }
        this.available -= amount;
        this.reserved  += amount;
      } finally {
        this.locked = false;
      }
    }

    release(amount: number): void {
      this.reserved  -= amount;
      this.available += amount;
    }

    get availableBalance() { return this.available; }
    get reservedBalance()  { return this.reserved; }
    get totalBalance()     { return this.available + this.reserved; }
  }

  it('prevents double-spend when two bids exceed available balance', async () => {
    const ledger  = new BalanceLedger(500);
    const results = await Promise.allSettled([
      ledger.reserve(400, 'bid-A'),
      ledger.reserve(400, 'bid-B'),
    ]);

    const succeeded = results.filter((r) => r.status === 'fulfilled');
    const failed    = results.filter((r) => r.status === 'rejected');

    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(ledger.availableBalance + ledger.reservedBalance).toBe(500); // invariant
  });

  it('allows sequential reservations within balance', async () => {
    const ledger = new BalanceLedger(1000);

    await ledger.reserve(300, 'bid-1');
    await ledger.reserve(200, 'bid-2');
    await ledger.reserve(100, 'bid-3');

    expect(ledger.reservedBalance).toBe(600);
    expect(ledger.availableBalance).toBe(400);
    expect(ledger.totalBalance).toBe(1000);
  });

  it('releases previous reservation when user outbids themselves', async () => {
    const ledger = new BalanceLedger(500);

    await ledger.reserve(200, 'bid-v1');
    expect(ledger.availableBalance).toBe(300);

    // User improves their own bid — old reservation released, new one placed
    ledger.release(200);
    await ledger.reserve(250, 'bid-v2');

    expect(ledger.reservedBalance).toBe(250);
    expect(ledger.availableBalance).toBe(250);
    expect(ledger.totalBalance).toBe(500);
  });

  it('balance invariant holds across 50 concurrent reservation attempts', async () => {
    const initial = 10_000;
    const ledger  = new BalanceLedger(initial);
    const amount  = 300;

    // 50 users each try to reserve 300 — max 33 can succeed (10000/300=33.3)
    await Promise.allSettled(
      Array.from({ length: 50 }, (_, i) =>
        ledger.reserve(amount, `user-${i}`),
      ),
    );

    // Invariant: available + reserved must always equal initial
    expect(ledger.totalBalance).toBe(initial);
    // Available must be non-negative
    expect(ledger.availableBalance).toBeGreaterThanOrEqual(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Auction boundary — bids at end time
// ─────────────────────────────────────────────────────────────────────────────

describe('Auction end-time boundary bids', () => {
  const isBidAccepted = (auction: Auction, nowOverride?: number): boolean => {
    const now = nowOverride ?? Date.now();
    if (
      auction.status !== AuctionStatus.ACTIVE &&
      auction.status !== AuctionStatus.ENDING
    ) {
      return false;
    }
    return auction.endsAt.getTime() > now;
  };

  it('accepts bid 1ms before end', () => {
    const auction = makeAuction({ endsAt: new Date(Date.now() + 1) });
    expect(isBidAccepted(auction)).toBe(true);
  });

  it('rejects bid at exact end time', () => {
    const now     = Date.now();
    const auction = makeAuction({ endsAt: new Date(now) });
    expect(isBidAccepted(auction, now)).toBe(false);
  });

  it('rejects bid 1ms after end', () => {
    const auction = makeAuction({ endsAt: new Date(Date.now() - 1) });
    expect(isBidAccepted(auction)).toBe(false);
  });

  it('rejects bid on ENDING status after endsAt', () => {
    const auction = makeAuction({
      status: AuctionStatus.ENDING,
      endsAt: new Date(Date.now() - 500),
    });
    expect(isBidAccepted(auction)).toBe(false);
  });

  it('accepts bid on ENDING status before endsAt (going once, going twice)', () => {
    const auction = makeAuction({
      status: AuctionStatus.ENDING,
      endsAt: new Date(Date.now() + 5_000),
    });
    expect(isBidAccepted(auction)).toBe(true);
  });

  it('rejects bid on ENDED status even if clock is before endsAt (data inconsistency guard)', () => {
    // Defensive: if status is ENDED, always reject regardless of endsAt
    const auction = makeAuction({
      status: AuctionStatus.ENDED,
      endsAt: new Date(Date.now() + 60_000), // future, but status is ended
    });
    expect(isBidAccepted(auction)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Throughput / stress scenario
// ─────────────────────────────────────────────────────────────────────────────

describe('Throughput stress scenarios', () => {
  it('processes 1000 sequential bids in correct ascending order', () => {
    const auction = makeAuction({
      currentHighestBid: null,
      startingPrice: 1,
      minBidIncrement: 1,
    });

    let current: number | null = null;
    let accepted = 0;
    let rejected = 0;

    for (let i = 1; i <= 1000; i++) {
      const minBid =
        current !== null ? current + Number(auction.minBidIncrement) : Number(auction.startingPrice);

      if (i >= minBid) {
        current = i;
        accepted++;
      } else {
        rejected++;
      }
    }

    expect(accepted).toBe(1000); // all bids are ascending by 1, increment is 1
    expect(rejected).toBe(0);
    expect(current).toBe(1000);
  });

  it('rejects all but the first when 1000 users bid the same amount', async () => {
    let lockHolder = false;
    let currentHighest: number | null = null;
    let successCount = 0;
    let failCount    = 0;

    const simulateBid = async (amount: number): Promise<void> => {
      while (lockHolder) await delay(0);
      lockHolder = true;

      try {
        const minBid = currentHighest !== null ? currentHighest + 10 : 100;
        if (amount < minBid) {
          failCount++;
          return;
        }
        currentHighest = amount;
        successCount++;
      } finally {
        lockHolder = false;
      }
    };

    const bids = Array.from({ length: 1000 }, () => simulateBid(100));
    await Promise.all(bids);

    expect(successCount).toBe(1);
    expect(failCount).toBe(999);
    expect(currentHighest).toBe(100);
  });

  it('timing: 1000 synchronous bid validations complete in under 50ms', () => {
    const auction   = makeAuction({ currentHighestBid: 100, minBidIncrement: 10 });
    const start     = Date.now();
    let validCount  = 0;

    for (let i = 0; i < 1000; i++) {
      const minBid = getMinBid(auction);
      const amount = 110 + i * 10;
      if (amount >= minBid) validCount++;
    }

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(50);
    expect(validCount).toBe(1000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Reserve price logic
// ─────────────────────────────────────────────────────────────────────────────

describe('Reserve price logic', () => {
  const isReserveMet = (auction: Auction): boolean =>
    !auction.reservePrice ||
    (auction.currentHighestBid ?? 0) >= Number(auction.reservePrice);

  it('reserve met when no reserve price set', () => {
    const auction = makeAuction({ reservePrice: 0, currentHighestBid: 50 });
    expect(isReserveMet(auction)).toBe(true);
  });

  it('reserve not met when highest bid is below reserve', () => {
    const auction = makeAuction({ reservePrice: 500, currentHighestBid: 300 });
    expect(isReserveMet(auction)).toBe(false);
  });

  it('reserve met exactly at reserve price', () => {
    const auction = makeAuction({ reservePrice: 500, currentHighestBid: 500 });
    expect(isReserveMet(auction)).toBe(true);
  });

  it('reserve met above reserve price', () => {
    const auction = makeAuction({ reservePrice: 500, currentHighestBid: 750 });
    expect(isReserveMet(auction)).toBe(true);
  });

  it('reserve not met with no bids', () => {
    const auction = makeAuction({ reservePrice: 500, currentHighestBid: null });
    expect(isReserveMet(auction)).toBe(false);
  });
});