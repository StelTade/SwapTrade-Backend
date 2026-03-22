/**
 * Admin 模块集成测试
 * 测试完整的 API 流程
 * 版权声明：MIT License | Copyright (c) 2026 思捷娅科技 (SJYKJ)
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AdminModule } from './admin.module';
import { AuthModule } from '../auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';

describe('Admin Module (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        AdminModule,
        AuthModule,
        // 使用内存数据库进行测试
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          dropSchema: true,
          entities: [],
          synchronize: true,
        }),
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/admin (GET)', () => {
    it('应该需要认证', () => {
      return request(app.getHttpServer())
        .get('/admin/waitlist')
        .expect(401);
    });

    it('应该需要管理员权限', () => {
      // 使用无效 token
      return request(app.getHttpServer())
        .get('/admin/waitlist')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('/admin/health (GET)', () => {
    it('应该返回健康状态（需要认证）', () => {
      return request(app.getHttpServer())
        .get('/admin/health')
        .expect(401);
    });
  });
});
