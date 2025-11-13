import { Test, TestingModule } from '@nestjs/testing';
import { CommonConfigService } from '@app/common-config';
import {
  RedisClientManager,
  RawRedisClientDefinition,
} from './redis-client.provider';
import Redis from 'ioredis';

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
    expect(Redis).toHaveBeenCalledWith('redis://localhost:6379');
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

  describe('getRawClient', () => {
    it('should return raw Redis client', () => {
      const client = manager.getRawClient();
      expect(client).toBe(mockRedisInstance);
    });
  });

  describe('onModuleDestroy', () => {
    it('should quit Redis connection', async () => {
      await manager.onModuleDestroy();
      expect(quitMock).toHaveBeenCalled();
    });
  });
});

describe('RawRedisClientDefinition', () => {
  it('should have correct provider configuration', () => {
    const provider = RawRedisClientDefinition as {
      provide: string;
      inject: unknown[];
      useFactory: (manager: RedisClientManager) => Redis;
    };
    expect(provider.provide).toBe('REDIS_CLIENT');
    expect(provider.inject).toEqual([RedisClientManager]);
    expect(provider.useFactory).toBeDefined();
  });

  it('should return client from factory', () => {
    const getRawClientSpy = jest.fn().mockReturnValue('mock-client');
    const mockManager = {
      getRawClient: getRawClientSpy,
    } as unknown as RedisClientManager;

    const provider = RawRedisClientDefinition as {
      useFactory: (manager: RedisClientManager) => Redis;
    };
    const result = provider.useFactory(mockManager);

    expect(result).toBe('mock-client');
    expect(getRawClientSpy).toHaveBeenCalled();
  });
});
