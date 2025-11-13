import { Test, TestingModule } from '@nestjs/testing';
import { CommonConfigService } from '@app/common-config';
import {
  RedisClientManager,
  RedisClientProviders,
  REDIS_CLIENT,
} from './redis-client.provider';
import Redis from 'ioredis';
import { FactoryProvider } from '@nestjs/common';

jest.mock('ioredis');

describe('RedisClientManager', () => {
  let manager: RedisClientManager;
  let mockRedisInstance: jest.Mocked<Redis>;
  let errorHandler: ((err: Error) => void) | undefined;
  let connectHandler: (() => void) | undefined;
  let onMock: jest.Mock;
  let quitMock: jest.Mock;

  beforeEach(async () => {
    onMock = jest.fn((event: string, handler: (err?: Error) => void) => {
      if (event === 'error') errorHandler = handler as (err: Error) => void;
      if (event === 'connect') connectHandler = handler as () => void;
      return mockRedisInstance;
    });
    quitMock = jest.fn().mockResolvedValue(undefined);

    mockRedisInstance = {
      on: onMock,
      quit: quitMock,
    } as unknown as jest.Mocked<Redis>;

    (Redis as jest.MockedClass<typeof Redis>).mockImplementation(
      () => mockRedisInstance,
    );

    const mockConfigService = {
      redis: {
        url: 'redis://localhost:6379',
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisClientManager,
        {
          provide: CommonConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    manager = module.get<RedisClientManager>(RedisClientManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(manager).toBeDefined();
  });

  it('should create Redis client with config url', () => {
    expect(Redis).toHaveBeenCalledTimes(3); // client, publisher, subscriber
    expect(Redis).toHaveBeenCalledWith(
      'redis://localhost:6379',
      expect.any(Object),
    );
  });

  it('should register error and connect handlers', () => {
    expect(onMock).toHaveBeenCalledWith('error', expect.any(Function));
    expect(onMock).toHaveBeenCalledWith('connect', expect.any(Function));
  });

  it('should handle error event', () => {
    const error = new Error('Connection error');
    if (errorHandler) {
      errorHandler(error);
    }
    // Just verify it doesn't throw
    expect(errorHandler).toBeDefined();
  });

  it('should handle connect event', () => {
    if (connectHandler) {
      connectHandler();
    }
    // Just verify it doesn't throw
    expect(connectHandler).toBeDefined();
  });

  describe('getClient', () => {
    it('should return raw Redis client', () => {
      const client = manager.getClient();
      expect(client).toBe(mockRedisInstance);
    });
  });

  describe('onModuleDestroy', () => {
    it('should quit all Redis connections', async () => {
      await manager.onModuleDestroy();
      expect(quitMock).toHaveBeenCalledTimes(3); // client, publisher, subscriber
    });
  });
});

describe('RedisClientProviders', () => {
  it('should have correct provider configuration for REDIS_CLIENT', () => {
    const clientProvider = RedisClientProviders.find(
      (p) => (p as FactoryProvider).provide === REDIS_CLIENT,
    ) as FactoryProvider;
    expect(clientProvider).toBeDefined();
    expect(clientProvider.inject).toEqual([RedisClientManager]);
    expect(clientProvider.useFactory).toBeDefined();
  });

  it('should return client from factory', () => {
    const getClientSpy = jest.fn().mockReturnValue('mock-client');
    const mockManager = {
      getClient: getClientSpy,
    } as unknown as RedisClientManager;

    const clientProvider = RedisClientProviders.find(
      (p) => (p as FactoryProvider).provide === REDIS_CLIENT,
    ) as FactoryProvider;
    const result = (
      clientProvider.useFactory as (m: RedisClientManager) => Redis
    )(mockManager);

    expect(result).toBe('mock-client');
    expect(getClientSpy).toHaveBeenCalled();
  });
});
