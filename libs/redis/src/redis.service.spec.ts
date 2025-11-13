import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { RedisService } from './redis.service';
import {
  REDIS_CLIENT,
  REDIS_PUBLISHER,
  REDIS_SUBSCRIBER,
} from './redis-client.provider';
import { Logger } from '@nestjs/common';

describe('RedisService', () => {
  let service: RedisService;

  const mockCacheManager = {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
  };

  const mockRawClient = {
    incr: jest.fn(),
    hgetall: jest.fn(),
    hset: jest.fn(),
    publish: jest.fn(),
    subscribe: jest.fn(),
    on: jest.fn(),
    expire: jest.fn(),
    ping: jest.fn(),
  };

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
        {
          provide: REDIS_CLIENT,
          useValue: mockRawClient,
        },
        {
          provide: REDIS_PUBLISHER,
          useValue: mockRawClient,
        },
        {
          provide: REDIS_SUBSCRIBER,
          useValue: mockRawClient,
        },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('set', () => {
    it('should set value with ttl', async () => {
      await service.set('key', 'value', 60);

      expect(mockCacheManager.set).toHaveBeenCalledWith('key', 'value', 60);
    });

    it('should set value without ttl', async () => {
      await service.set('key', 'value');

      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'key',
        'value',
        undefined,
      );
    });

    it('should set complex object', async () => {
      const obj = { name: 'test', count: 5 };
      await service.set('key', obj, 30);

      expect(mockCacheManager.set).toHaveBeenCalledWith('key', obj, 30);
    });
  });

  describe('get', () => {
    it('should get value from cache', async () => {
      mockCacheManager.get.mockResolvedValue('cached-value');

      const result = await service.get('key');

      expect(result).toBe('cached-value');
      expect(mockCacheManager.get).toHaveBeenCalledWith('key');
    });

    it('should return null if value not found', async () => {
      mockCacheManager.get.mockResolvedValue(undefined);

      const result = await service.get('key');

      expect(result).toBeNull();
    });
  });

  describe('del', () => {
    it('should delete key from cache', async () => {
      await service.del('key');

      expect(mockCacheManager.del).toHaveBeenCalledWith('key');
    });
  });

  describe('incr', () => {
    it('should increment value', async () => {
      mockRawClient.incr.mockResolvedValue(5);

      const result = await service.incr('counter');

      expect(result).toBe(5);
      expect(mockRawClient.incr).toHaveBeenCalledWith('counter');
    });
  });

  describe('hGetAll', () => {
    it('should get all hash fields', async () => {
      const hashData = { field1: 'value1', field2: 'value2' };
      mockRawClient.hgetall.mockResolvedValue(hashData);

      const result = await service.hGetAll('hash-key');

      expect(result).toEqual(hashData);
      expect(mockRawClient.hgetall).toHaveBeenCalledWith('hash-key');
    });
  });

  describe('hSet', () => {
    it('should set hash field', async () => {
      mockRawClient.hset.mockResolvedValue(1);

      const result = await service.hSet('hash-key', 'field', 'value');

      expect(result).toBe(1);
      expect(mockRawClient.hset).toHaveBeenCalledWith(
        'hash-key',
        'field',
        'value',
      );
    });
  });

  describe('publish', () => {
    it('should publish message to channel', async () => {
      mockRawClient.publish.mockResolvedValue(3);

      const result = await service.publish('channel', 'message');

      expect(result).toBe(3);
      expect(mockRawClient.publish).toHaveBeenCalledWith('channel', 'message');
    });

    it('should publish object message as JSON', async () => {
      const message = { type: 'test', data: 'value' };
      mockRawClient.publish.mockResolvedValue(2);

      const result = await service.publish('channel', message);

      expect(result).toBe(2);
      expect(mockRawClient.publish).toHaveBeenCalledWith(
        'channel',
        JSON.stringify(message),
      );
    });
  });

  describe('subscribe', () => {
    it('should subscribe to channel and handle messages', async () => {
      const callback = jest.fn();
      mockRawClient.subscribe.mockResolvedValue(1);

      await service.subscribe('test-channel', callback);

      expect(mockRawClient.subscribe).toHaveBeenCalledWith('test-channel');
      expect(mockRawClient.on).toHaveBeenCalledWith(
        'message',
        expect.any(Function),
      );

      // Simulate receiving a message
      const onCalls = mockRawClient.on.mock.calls as Array<
        [string, (ch: string, msg: string) => void]
      >;
      const messageHandler = onCalls[0][1];
      messageHandler('test-channel', 'test-message');

      expect(callback).toHaveBeenCalledWith('test-message');
    });

    it('should not call callback for different channel', async () => {
      const callback = jest.fn();
      mockRawClient.subscribe.mockResolvedValue(1);

      await service.subscribe('test-channel', callback);

      // Simulate receiving a message on a different channel
      const onCalls = mockRawClient.on.mock.calls as Array<
        [string, (ch: string, msg: string) => void]
      >;
      const messageHandler = onCalls[0][1];
      messageHandler('other-channel', 'test-message');

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('rateLimit', () => {
    it('should allow request when under limit', async () => {
      mockRawClient.incr.mockResolvedValue(1);

      const result = await service.rateLimit('user:123', 10, 60);

      expect(mockRawClient.incr).toHaveBeenCalledWith('user:123');
      expect(mockRawClient.expire).toHaveBeenCalledWith('user:123', 60);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
      expect(result.resetAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('should deny request when over limit', async () => {
      mockRawClient.incr.mockResolvedValue(11);

      const result = await service.rateLimit('user:123', 10, 60);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should not set expire for subsequent requests', async () => {
      mockRawClient.incr.mockResolvedValue(5);

      await service.rateLimit('user:123', 10, 60);

      expect(mockRawClient.expire).not.toHaveBeenCalled();
    });
  });

  describe('healthCheck', () => {
    it('should return up status when redis is reachable', async () => {
      mockRawClient.ping.mockResolvedValue('PONG');

      const result = await service.healthCheck();

      expect(result).toEqual({ status: 'up' });
      expect(mockRawClient.ping).toHaveBeenCalled();
    });

    it('should return down status when redis is unreachable', async () => {
      const error = new Error('Connection refused');
      mockRawClient.ping.mockRejectedValue(error);

      const result = await service.healthCheck();

      expect(result).toEqual({
        status: 'down',
        error: 'Error: Connection refused',
      });
    });
  });
});
