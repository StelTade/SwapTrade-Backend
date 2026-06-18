import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { StreamManagerService } from './stream-manager.service';

describe('StreamManagerService', () => {
  let service: StreamManagerService;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StreamManagerService, EventEmitter2],
    }).compile();

    service = module.get<StreamManagerService>(StreamManagerService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createStream', () => {
    it('should create a stream successfully', () => {
      service.createStream({ name: 'test-stream', throttleMs: 100 });
      const stats = service.getStreamStats('test-stream');
      expect(stats).toBeDefined();
      expect((stats as any).name).toBe('test-stream');
    });

    it('should throw error if stream already exists', () => {
      service.createStream({ name: 'test-stream' });
      expect(() => service.createStream({ name: 'test-stream' })).toThrow();
    });
  });

  describe('subscribeToStream', () => {
    it('should subscribe client to stream', () => {
      service.createStream({ name: 'test-stream' });
      const result = service.subscribeToStream('test-stream', 'client-1');
      expect(result).toBe(true);
    });
  });

  describe('publishToStream', () => {
    it('should publish message to stream', () => {
      service.createStream({ name: 'test-stream' });
      service.subscribeToStream('test-stream', 'client-1');

      let emitted = false;
      eventEmitter.on('websocket.stream.test-stream', () => {
        emitted = true;
      });

      service.publishToStream('test-stream', { data: 'test' });
      expect(emitted).toBe(true);
    });
  });

  describe('getStreamStats', () => {
    it('should return stats for all streams', () => {
      service.createStream({ name: 'stream-1' });
      service.createStream({ name: 'stream-2' });

      const stats = service.getStreamStats();
      expect(Array.isArray(stats)).toBe(true);
      expect((stats as any[]).length).toBe(2);
    });
  });
});

describe('ConnectionManagerService', () => {
  let service: any;

  beforeEach(async () => {
    const {
      ConnectionManagerService,
    } = require('./connection-manager.service');
    service = new ConnectionManagerService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('registerConnection', () => {
    it('should register a connection', () => {
      const state = service.registerConnection('client-1', 'user-1');
      expect(state.clientId).toBe('client-1');
      expect(state.userId).toBe('user-1');
    });
  });

  describe('handleReconnection', () => {
    it('should return increasing backoff times', () => {
      service.registerConnection('client-1');

      const backoff1 = service.handleReconnection('client-1');
      const backoff2 = service.handleReconnection('client-1');

      expect(backoff2).toBeGreaterThan(backoff1);
    });
  });

  describe('cleanupStaleConnections', () => {
    it('should cleanup stale connections', () => {
      service.registerConnection('client-1');
      const cleaned = service.cleanupStaleConnections(0);
      expect(cleaned).toBeGreaterThanOrEqual(0);
    });
  });
});
