import { Injectable, Logger, OnModuleDestroy, Provider } from '@nestjs/common';
import { CommonConfigService } from '@app/common-config';
import Redis, { Redis as RedisClient, Cluster } from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';
export const REDIS_PUBLISHER = 'REDIS_PUBLISHER';
export const REDIS_SUBSCRIBER = 'REDIS_SUBSCRIBER';

type RedisInstance = RedisClient | Cluster;

interface RedisClusterNode {
  host: string;
  port: number;
}

function createRedisInstance(url: string): RedisInstance {
  // Auto-detect cluster format
  if (url.startsWith('redis+cluster://')) {
    const nodes: RedisClusterNode[] = url
      .replace('redis+cluster://', '')
      .split(',')
      .map((n) => {
        const [host, port] = n.split(':');
        return { host, port: Number(port) };
      });

    return new Cluster(nodes, {
      redisOptions: {
        maxRetriesPerRequest: null,
      },
      clusterRetryStrategy: (times: number) => Math.min(times * 200, 3000),
    });
  }

  // Fallback: Single-node mode
  return new Redis(url, {
    retryStrategy(times: number) {
      return Math.min(times * 200, 3000);
    },
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
}

@Injectable()
export class RedisClientManager implements OnModuleDestroy {
  private readonly logger = new Logger(RedisClientManager.name);

  private readonly client: RedisInstance;
  private readonly publisher: RedisInstance;
  private readonly subscriber: RedisInstance;

  constructor(private readonly config: CommonConfigService) {
    const url: string = this.config.redis.url;

    this.client = createRedisInstance(url);
    this.publisher = createRedisInstance(url);
    this.subscriber = createRedisInstance(url);

    const log = (name: string): void =>
      this.logger.log(`${name} connected (Redis)`);

    this.client.on('connect', () => log('Main client'));
    this.publisher.on('connect', () => log('Publisher'));
    this.subscriber.on('connect', () => log('Subscriber'));

    this.client.on('error', (e: unknown) =>
      this.logger.error('Client Error:', e),
    );
    this.publisher.on('error', (e: unknown) =>
      this.logger.error('Publisher Error:', e),
    );
    this.subscriber.on('error', (e: unknown) =>
      this.logger.error('Subscriber Error:', e),
    );
  }

  getClient(): RedisInstance {
    return this.client;
  }
  getPublisher(): RedisInstance {
    return this.publisher;
  }
  getSubscriber(): RedisInstance {
    return this.subscriber;
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Closing Redis clients...');
    await Promise.all([
      this.client.quit?.(),
      this.publisher.quit?.(),
      this.subscriber.quit?.(),
    ]);
  }
}

export const RedisClientProviders: Provider[] = [
  {
    provide: REDIS_CLIENT,
    useFactory: (m: RedisClientManager) => m.getClient(),
    inject: [RedisClientManager],
  },
  {
    provide: REDIS_PUBLISHER,
    useFactory: (m: RedisClientManager) => m.getPublisher(),
    inject: [RedisClientManager],
  },
  {
    provide: REDIS_SUBSCRIBER,
    useFactory: (m: RedisClientManager) => m.getSubscriber(),
    inject: [RedisClientManager],
  },
];
