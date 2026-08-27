import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLog } from 'src/common/security/audit-log.entity';
import { AuditLogController } from './audit-log.controller';
import { AuditLogService } from './audit-log.service';

describe('AuditLogController', () => {
  let controller: AuditLogController;
  let service: AuditLogService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditLogController],
      providers: [
        AuditLogService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: {
            findOne: jest.fn().mockResolvedValue(null),
            create: jest.fn((x) => x),
            save: jest.fn(async (x) => ({ id: 'test-id', ...x })),
            find: jest.fn().mockResolvedValue([]),
            findAndCount: jest.fn().mockResolvedValue([[], 0]),
          },
        },
      ],
    }).compile();

    controller = module.get<AuditLogController>(AuditLogController);
    service = module.get<AuditLogService>(AuditLogService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('exposes signed export link creation and redemption', async () => {
    const link = await controller.createSignedExportLink({
      from: '2024-01-01T00:00:00Z',
      to: '2024-01-31T23:59:59Z',
      format: 'json',
    });
    expect(link.url).toContain('/admin/audit/export/download?token=');

    const token = new URL(link.url, 'http://x').searchParams.get('token')!;
    const doc = (await controller.downloadSignedExport(token)) as {
      filename: string;
      contentType: string;
      content: string;
    } | null;
    expect(doc).not.toBeNull();
    expect(doc!.contentType).toContain('application/json');
  });

  it('returns a rejection payload for tampered tokens', async () => {
    const res = await controller.downloadSignedExport('abc.def');
    expect(res).toMatchObject({ statusCode: 403 });
  });
});
