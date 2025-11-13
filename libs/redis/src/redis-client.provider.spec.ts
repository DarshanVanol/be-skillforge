import { Test, TestingModule } from '@nestjs/testing';
import { CommonConfigService } from '@app/common-config';
import {
  RedisClientManager,
  RedisClientProviders,
  REDIS_CLIENT,
  REDIS_PUBLISHER,
  REDIS_SUBSCRIBER,
} from './redis-client.provider';
import Redis, { Cluster } from 'ioredis';
import { FactoryProvider } from '@nestjs/common';

type MockedRedis = {
  on: jest.Mock;
  quit: jest.Mock;
};

type RedisConstructor = jest.MockedFunction<
  (url: string, options: Record<string, unknown>) => MockedRedis
>;

type ClusterConstructor = jest.MockedFunction<
  (nodes: unknown[], options: Record<string, unknown>) => MockedRedis
>;

jest.mock('ioredis', () => {
  const mockOn = jest.fn();
  const mockQuit = jest.fn().mockResolvedValue(undefined);

  const MockRedis = jest.fn().mockImplementation(() => ({
    on: mockOn,
    quit: mockQuit,
  }));

  const MockCluster = jest.fn().mockImplementation(() => ({
    on: mockOn,
    quit: mockQuit,
  }));

  return {
    __esModule: true,
    default: MockRedis,
    Cluster: MockCluster,
  };
});

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

  it('should create error handlers for all clients', () => {
    // Verify all 3 clients (client, publisher, subscriber) have error handlers
    const errorCalls = onMock.mock.calls.filter(
      (call: unknown[]) => call[0] === 'error',
    );
    expect(errorCalls).toHaveLength(3);

    // Trigger each error handler to ensure they all work
    errorCalls.forEach((call: unknown[]) => {
      const handler = call[1] as (err: Error) => void;
      handler(new Error('Test error'));
    });
  });

  it('should handle connect event', () => {
    if (connectHandler) {
      connectHandler();
    }
    // Just verify it doesn't throw
    expect(connectHandler).toBeDefined();
  });

  it('should create connect handlers for all clients', () => {
    // Verify all 3 clients (client, publisher, subscriber) have connect handlers
    const connectCalls = onMock.mock.calls.filter(
      (call: unknown[]) => call[0] === 'connect',
    );
    expect(connectCalls).toHaveLength(3);

    // Trigger each connect handler to ensure they all work
    connectCalls.forEach((call: unknown[]) => {
      const handler = call[1] as () => void;
      handler();
    });
  });

  describe('getClient', () => {
    it('should return raw Redis client', () => {
      const client = manager.getClient();
      expect(client).toBe(mockRedisInstance);
    });
  });

  describe('getPublisher', () => {
    it('should return publisher instance', () => {
      const publisher = manager.getPublisher();
      expect(publisher).toBe(mockRedisInstance);
    });
  });

  describe('getSubscriber', () => {
    it('should return subscriber instance', () => {
      const subscriber = manager.getSubscriber();
      expect(subscriber).toBe(mockRedisInstance);
    });
  });

  describe('Redis retryStrategy', () => {
    it('should have retryStrategy function', () => {
      const RedisMock = Redis as unknown as RedisConstructor;
      const redisCall = RedisMock.mock.calls[0];
      const options = redisCall[1] as {
        retryStrategy: (times: number) => number;
      };
      expect(options.retryStrategy).toBeDefined();

      // Test the retry strategy
      const retryTime = options.retryStrategy(1);
      expect(retryTime).toBe(200);

      const retryTime2 = options.retryStrategy(10);
      expect(retryTime2).toBe(2000);

      const retryTime3 = options.retryStrategy(20);
      expect(retryTime3).toBe(3000); // Should be capped at 3000
    });
  });

  describe('onModuleDestroy', () => {
    it('should quit all Redis connections', async () => {
      await manager.onModuleDestroy();
      expect(quitMock).toHaveBeenCalledTimes(3); // client, publisher, subscriber
    });

    it('should handle quit failure gracefully', async () => {
      quitMock.mockRejectedValueOnce(new Error('Quit failed'));
      await expect(manager.onModuleDestroy()).rejects.toThrow();
    });
  });
});

describe('RedisClientManager with Cluster', () => {
  let clusterManager: RedisClientManager;

  beforeEach(async () => {
    jest.clearAllMocks();

    const mockConfigService = {
      redis: {
        url: 'redis+cluster://node1:6379,node2:6379',
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

    clusterManager = module.get<RedisClientManager>(RedisClientManager);
  });

  it('should create cluster instances for cluster URLs', () => {
    expect(Cluster).toHaveBeenCalled();
    expect(clusterManager).toBeDefined();
  });

  it('should parse cluster nodes correctly', () => {
    const expectedNodes: Array<{ host: string; port: number }> = [
      { host: 'node1', port: 6379 },
      { host: 'node2', port: 6379 },
    ];
    const clusterMock = Cluster as unknown as ClusterConstructor;
    const callArgs = clusterMock.mock.calls[0];

    expect(callArgs[0]).toEqual(expectedNodes);
    expect(callArgs[1]).toHaveProperty('redisOptions');
    expect(callArgs[1]).toHaveProperty('clusterRetryStrategy');
  });

  it('should have clusterRetryStrategy function', () => {
    const ClusterMock = Cluster as unknown as ClusterConstructor;
    const clusterCall = ClusterMock.mock.calls[0];
    const options = clusterCall[1] as {
      clusterRetryStrategy: (times: number) => number;
    };
    expect(options.clusterRetryStrategy).toBeDefined();

    // Test the retry strategy
    const retryTime = options.clusterRetryStrategy(1);
    expect(retryTime).toBe(200);

    const retryTime2 = options.clusterRetryStrategy(10);
    expect(retryTime2).toBe(2000);

    const retryTime3 = options.clusterRetryStrategy(20);
    expect(retryTime3).toBe(3000); // Should be capped at 3000
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

  it('should have correct provider configuration for REDIS_PUBLISHER', () => {
    const publisherProvider = RedisClientProviders.find(
      (p) => (p as FactoryProvider).provide === REDIS_PUBLISHER,
    ) as FactoryProvider;
    expect(publisherProvider).toBeDefined();
    expect(publisherProvider.inject).toEqual([RedisClientManager]);
    expect(publisherProvider.useFactory).toBeDefined();
  });

  it('should have correct provider configuration for REDIS_SUBSCRIBER', () => {
    const subscriberProvider = RedisClientProviders.find(
      (p) => (p as FactoryProvider).provide === REDIS_SUBSCRIBER,
    ) as FactoryProvider;
    expect(subscriberProvider).toBeDefined();
    expect(subscriberProvider.inject).toEqual([RedisClientManager]);
    expect(subscriberProvider.useFactory).toBeDefined();
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

  it('should return publisher from factory', () => {
    const getPublisherSpy = jest.fn().mockReturnValue('mock-publisher');
    const mockManager = {
      getPublisher: getPublisherSpy,
    } as unknown as RedisClientManager;

    const publisherProvider = RedisClientProviders.find(
      (p) => (p as FactoryProvider).provide === REDIS_PUBLISHER,
    ) as FactoryProvider;
    const result = (
      publisherProvider.useFactory as (m: RedisClientManager) => Redis
    )(mockManager);

    expect(result).toBe('mock-publisher');
    expect(getPublisherSpy).toHaveBeenCalled();
  });

  it('should return subscriber from factory', () => {
    const getSubscriberSpy = jest.fn().mockReturnValue('mock-subscriber');
    const mockManager = {
      getSubscriber: getSubscriberSpy,
    } as unknown as RedisClientManager;

    const subscriberProvider = RedisClientProviders.find(
      (p) => (p as FactoryProvider).provide === REDIS_SUBSCRIBER,
    ) as FactoryProvider;
    const result = (
      subscriberProvider.useFactory as (m: RedisClientManager) => Redis
    )(mockManager);

    expect(result).toBe('mock-subscriber');
    expect(getSubscriberSpy).toHaveBeenCalled();
  });
});
