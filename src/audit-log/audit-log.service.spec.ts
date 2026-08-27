import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLog } from 'src/common/security/audit-log.entity';
import {
  AuditEventType,
  AuditSeverity,
} from 'src/common/security/audit-log.entity';
import { AuditLogService, WormSink } from './audit-log.service';
import { FileWormSink } from './file-worm-sink';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let repo: Record<string, jest.Mock>;
  let worm: { append: jest.Mock };
  let now: number;

  const makeEntry = (dto: any, previousChecksum = 'GENESIS') => {
    const timestamp = new Date(now * 1000).toISOString();
    const checksum = service.computeChecksum(dto, timestamp, previousChecksum);
    return {
      id: `id-${checksum.slice(0, 8)}`,
      ...dto,
      severity: dto.severity ?? AuditSeverity.INFO,
      checksum,
      previousChecksum,
      createdAt: new Date(timestamp),
    };
  };

  beforeEach(async () => {
    now = 1_700_000_000;
    const isoOriginal = Date.prototype.toISOString;
    // Deterministic timestamps for checksum stability.
    jest.spyOn(Date.prototype, 'toISOString').mockImplementation(function (
      this: Date,
    ) {
      return isoOriginal.call(new Date(now * 1000));
    });

    repo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
    };

    worm = { append: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        { provide: getRepositoryToken(AuditLog), useValue: repo },
        { provide: 'AUDIT_WORM_SINK', useValue: worm },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const loginDto = {
    userId: 'user-1',
    eventType: AuditEventType.LOGIN,
    ipAddress: '10.0.0.1',
  };

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('log()', () => {
    it('chains to the previous entry and writes to the WORM sink', async () => {
      const prev = makeEntry(loginDto);
      repo.findOne.mockResolvedValue(prev);
      const saved = makeEntry(
        { userId: 'user-2', eventType: AuditEventType.WITHDRAWAL },
        prev.checksum,
      );
      saved.previousChecksum = prev.checksum;
      repo.create.mockImplementation((x) => x);
      repo.save.mockResolvedValue(saved);

      const result = await service.log({
        userId: 'user-2',
        eventType: AuditEventType.WITHDRAWAL,
      });

      expect(result.previousChecksum).toBe(prev.checksum);
      expect(worm.append).toHaveBeenCalledTimes(1);
      expect(worm.append.mock.calls[0][0].eventType).toBe(
        AuditEventType.WITHDRAWAL,
      );
    });

    it('keeps the DB record even when the WORM sink fails', async () => {
      worm.append.mockRejectedValue(new Error('s3 unavailable'));
      repo.create.mockImplementation((x) => x);
      repo.save.mockImplementation(async (x) => ({ id: 'saved-id', ...x }));

      const result = await service.log(loginDto);
      expect(result.id).toBe('saved-id');
    });

    it('uses GENESIS when the chain is empty', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.create.mockImplementation((x) => x);
      repo.save.mockImplementation(async (x) => x);

      const entry = await service.log(loginDto);
      expect(entry.previousChecksum).toBe('GENESIS');
    });
  });

  describe('verifyChainIntegrity()', () => {
    function buildChain(dtos: any[]) {
      const chain: any[] = [];
      let previous = 'GENESIS';
      for (const dto of dtos) {
        const entry = makeEntry(dto, previous);
        entry.previousChecksum = previous;
        chain.push(entry);
        previous = entry.checksum;
      }
      return chain;
    }

    it('reports a valid chain when nothing was modified', async () => {
      const chain = buildChain([
        loginDto,
        { userId: 'u2', eventType: AuditEventType.KYC_UPDATED },
        { userId: 'u3', eventType: AuditEventType.SETTLEMENT_EXECUTED },
      ]);
      repo.find.mockResolvedValue(chain);

      const result = await service.verifyChainIntegrity();
      expect(result.valid).toBe(true);
      expect(result.brokenLinks).toHaveLength(0);
      expect(result.tamperedEntries).toHaveLength(0);
    });

    it('detects a mutated row (tamper evidence)', async () => {
      const chain = buildChain([
        loginDto,
        {
          userId: 'u2',
          eventType: AuditEventType.ADMIN_ACTION,
          beforeState: { role: 'user' },
          afterState: { role: 'admin' },
        },
      ]);
      // Attacker edits afterState in place without fixing checksums.
      chain[1].afterState = { role: 'superadmin' };
      repo.find.mockResolvedValue(chain);

      const result = await service.verifyChainIntegrity();
      expect(result.valid).toBe(false);
      expect(result.tamperedEntries).toHaveLength(1);
      expect(result.tamperedEntries[0].userId).toBe('u2');
    });

    it('detects broken hash linkage', async () => {
      const chain = buildChain([
        loginDto,
        { userId: 'u2', eventType: AuditEventType.DEPOSIT },
      ]);
      chain[1].previousChecksum = 'deadbeef';
      repo.find.mockResolvedValue(chain);

      const result = await service.verifyChainIntegrity();
      expect(result.valid).toBe(false);
      expect(result.brokenLinks).toHaveLength(1);
    });
  });

  describe('exports', () => {
    it('produces CSV with headers for a range', async () => {
      repo.find.mockResolvedValue([makeEntry(loginDto)]);
      const csv = await service.exportAuditLog({
        from: new Date(0),
        to: new Date(),
      });
      expect(csv.split('\n')).toHaveLength(2);
      expect(csv).toContain('Event Type');
      expect(csv).toContain(AuditEventType.LOGIN);
    });

    it('produces JSON export including per-entry checksum validity', async () => {
      const good = makeEntry(loginDto);
      const bad = makeEntry({ userId: 'u2', eventType: AuditEventType.LOGOUT });
      bad.afterState = { tampered: true }; // invalidate
      repo.find.mockResolvedValue([good, bad]);

      const json = (await service.exportAuditLogJson({
        from: new Date(0),
        to: new Date(),
      })) as unknown as {
        count: number;
        entries: Array<{ checksumValid: boolean }>;
      };
      expect(json.count).toBe(2);
      expect(json.entries[0].checksumValid).toBe(true);
      expect(json.entries[1].checksumValid).toBe(false);
    });
  });

  describe('signed export links (issue #423)', () => {
    it('issues a link that redeems to a CSV document', async () => {
      repo.find.mockResolvedValue([]);
      repo.create.mockImplementation((x) => x);
      repo.save.mockImplementation(async (x) => x);

      const link = await service.createSignedExportLink(
        { from: new Date(0), to: new Date(now * 1000) },
        'csv',
        300,
      );
      expect(link.url).toMatch(/^\/admin\/audit\/export\/download\?token=/);
      expect(link.expiresAt.getTime()).toBeGreaterThan(Date.now());

      const token = link.url.split('token=')[1];
      const doc = await service.downloadSignedExport(token);
      expect(doc).not.toBeNull();
      expect(doc!.contentType).toContain('text/csv');
      expect(doc!.content).toContain('ID');
      // Link issuance is itself audit logged.
      expect(repo.save).toHaveBeenCalled();
    });

    it('redeems JSON links with content type application/json', async () => {
      repo.find.mockResolvedValue([]);
      repo.create.mockImplementation((x) => x);
      repo.save.mockImplementation(async (x) => x);

      const link = await service.createSignedExportLink(
        { from: new Date(0), to: new Date() },
        'json',
      );
      const doc = await service.downloadSignedExport(
        link.url.split('token=')[1],
      );
      expect(doc!.contentType).toContain('application/json');
      const parsed = JSON.parse(doc!.content);
      expect(parsed).toHaveProperty('entries');
      expect(parsed).toHaveProperty('count');
    });

    it('rejects tokens signed with a different secret', async () => {
      repo.create.mockImplementation((x) => x);
      repo.save.mockImplementation(async (x) => ({ id: 'export-audit', ...x }));
      const link = await service.createSignedExportLink(
        { from: new Date(0), to: new Date() },
        'csv',
      );
      process.env.AUDIT_EXPORT_SECRET = 'rotated-secret';
      try {
        const doc = await service.downloadSignedExport(
          link.url.split('token=')[1],
        );
        expect(doc).toBeNull();
      } finally {
        delete process.env.AUDIT_EXPORT_SECRET;
      }
    });

    it('rejects expired tokens', async () => {
      repo.create.mockImplementation((x) => x);
      repo.save.mockImplementation(async (x) => ({ id: 'export-audit', ...x }));
      const link = await service.createSignedExportLink(
        { from: new Date(0), to: new Date() },
        'csv',
        -1, // already expired
      );
      const doc = await service.downloadSignedExport(
        link.url.split('token=')[1],
      );
      expect(doc).toBeNull();
    });

    it('rejects malformed tokens', async () => {
      expect(await service.downloadSignedExport('garbage')).toBeNull();
      expect(await service.downloadSignedExport('a.b.c')).toBeNull();
    });
  });

  describe('FileWormSink', () => {
    it('is an append-only WormSink implementation', () => {
      const sink: WormSink = new FileWormSink('/tmp/audit-worm-test');
      expect(typeof sink.append).toBe('function');
    });
  });
});
