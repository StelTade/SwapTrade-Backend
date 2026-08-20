import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, EntityManager } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { WalletLedgerService } from './wallet-ledger.service';
import { WalletLedger } from '../entities/wallet-ledger.entity';
import { LedgerEntry } from '../entities/ledger-entry.entity';

/**
 * In-memory ledger store backing the mocked DataSource. `transaction` hands the
 * service the same stateful `manager` every time, so mutations persist across
 * calls and we can assert the real reserve/release/debit arithmetic and the
 * idempotency + non-negative invariants end-to-end.
 */
function createLedgerStore() {
  const ledgers = new Map<string, WalletLedger>();
  const entries: LedgerEntry[] = [];
  const key = (userId: string, asset: string) => `${userId}:${asset}`;

  const instantiate = (entity: any, data: any) =>
    entity === WalletLedger
      ? Object.assign(new WalletLedger(), data)
      : Object.assign(new LedgerEntry(), data);

  const manager = {
    create: (entity: any, data: any) => instantiate(entity, data),
    save: (entity: any, obj: any) => {
      if (entity === WalletLedger) {
        ledgers.set(key(obj.userId, obj.asset), obj);
      } else {
        entries.push(obj);
      }
      return Promise.resolve(obj);
    },
    findOne: (entity: any, opts: any) => {
      const where = opts?.where ?? {};
      if (entity === WalletLedger) {
        return Promise.resolve(ledgers.get(key(where.userId, where.asset)) ?? null);
      }
      if (where.idempotencyKey !== undefined) {
        return Promise.resolve(
          entries.find((e) => e.idempotencyKey === where.idempotencyKey) ?? null,
        );
      }
      return Promise.resolve(null);
    },
  } as unknown as EntityManager;

  const repoFor = (entity: any) => ({
    findOne: (opts: any) => manager.findOne(entity, opts),
    find: (opts: any) => {
      const where = opts?.where ?? {};
      const rows =
        entity === WalletLedger
          ? [...ledgers.values()]
          : entries;
      return Promise.resolve(
        rows.filter(
          (r: any) =>
            r.userId === where.userId &&
            (where.asset === undefined || r.asset === where.asset),
        ),
      );
    },
    create: (data: any) => instantiate(entity, data),
    save: (obj: any) => manager.save(entity, obj),
  });

  const dataSource = {
    getRepository: (entity: any) => repoFor(entity),
    transaction: (cb: any) => Promise.resolve(cb(manager)),
  } as unknown as DataSource;

  return { ledgers, entries, dataSource };
}

const REF = { referenceType: 'test', referenceId: 'r1' };

describe('WalletLedgerService', () => {
  let service: WalletLedgerService;
  let store: ReturnType<typeof createLedgerStore>;

  beforeEach(async () => {
    store = createLedgerStore();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletLedgerService,
        { provide: DataSource, useValue: store.dataSource },
      ],
    }).compile();
    service = module.get(WalletLedgerService);
  });

  it('credits available and derives total = available + reserved', async () => {
    const balance = await service.credit('u1', 'USDC', 100, REF);
    expect(balance.available).toBe(100);
    expect(balance.reserved).toBe(0);
    expect(balance.total).toBe(100);
  });

  it('applies a credit with the same idempotencyKey at most once', async () => {
    const ref = { ...REF, idempotencyKey: 'deposit:stellar:tx1' };
    await service.credit('u1', 'USDC', 100, ref);
    const second = await service.credit('u1', 'USDC', 100, ref);

    // Balance unchanged on the duplicate, and only one ledger entry written.
    expect(second.available).toBe(100);
    expect(second.total).toBe(100);
    expect(
      store.entries.filter((e) => e.idempotencyKey === 'deposit:stellar:tx1'),
    ).toHaveLength(1);
  });

  it('reserves by moving available → reserved', async () => {
    await service.credit('u1', 'USDC', 100, REF);
    const balance = await service.reserve('u1', 'USDC', 40, REF);
    expect(balance.available).toBe(60);
    expect(balance.reserved).toBe(40);
    expect(balance.total).toBe(100);
  });

  it('throws and mutates nothing when reserving more than available', async () => {
    await service.credit('u1', 'USDC', 30, REF);
    await expect(service.reserve('u1', 'USDC', 100, REF)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    const balance = await service.getBalance('u1', 'USDC');
    expect(balance.available).toBe(30);
    expect(balance.reserved).toBe(0);
  });

  it('releases by moving reserved → available (clamped at 0)', async () => {
    await service.credit('u1', 'USDC', 100, REF);
    await service.reserve('u1', 'USDC', 40, REF);
    const balance = await service.release('u1', 'USDC', 40, REF);
    expect(balance.available).toBe(100);
    expect(balance.reserved).toBe(0);
  });

  it('debits reserved on completion, dropping reserved and total', async () => {
    await service.credit('u1', 'USDC', 100, REF);
    await service.reserve('u1', 'USDC', 40, REF);
    const balance = await service.debitReserved('u1', 'USDC', 40, {
      ...REF,
      idempotencyKey: 'withdrawal-debit:w1',
    });
    expect(balance.available).toBe(60);
    expect(balance.reserved).toBe(0);
    expect(balance.total).toBe(60);
  });

  it('applies a reserved-debit with the same idempotencyKey at most once', async () => {
    await service.credit('u1', 'USDC', 100, REF);
    await service.reserve('u1', 'USDC', 40, REF);
    const ref = { ...REF, idempotencyKey: 'withdrawal-debit:w1' };
    await service.debitReserved('u1', 'USDC', 40, ref);
    const second = await service.debitReserved('u1', 'USDC', 40, ref);
    // Second call is a no-op: reserved not driven negative, total stays 60.
    expect(second.available).toBe(60);
    expect(second.reserved).toBe(0);
    expect(second.total).toBe(60);
  });

  it('debits available directly and rejects an overdraft', async () => {
    await service.credit('u1', 'USDC', 100, REF);
    const balance = await service.debit('u1', 'USDC', 30, REF);
    expect(balance.available).toBe(70);

    await expect(service.debit('u1', 'USDC', 1000, REF)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect((await service.getBalance('u1', 'USDC')).available).toBe(70);
  });

  it('keeps a full audit trail of entries', async () => {
    await service.credit('u1', 'USDC', 100, REF);
    await service.reserve('u1', 'USDC', 40, REF);
    const history = await service.getLedgerHistory('u1', 'USDC');
    expect(history).toHaveLength(2);
  });
});
