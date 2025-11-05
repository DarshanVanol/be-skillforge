import { Injectable, Logger, OnModuleDestroy, Provider } from '@nestjs/common';
import { CommonConfigService } from '@app/common-config';
import Redis from 'ioredis';

// 💡 TOKEN: The unique identifier used to inject the raw client.
export const REDIS_CLIENT = 'REDIS_CLIENT';

@Injectable()
// 1. CLASS: Manages the connection, error logging, and graceful shutdown (Lifecycle).
export class RedisClientManager implements OnModuleDestroy {
  private readonly client: Redis;
  private readonly logger = new Logger(RedisClientManager.name);

  constructor(private readonly config: CommonConfigService) {
    this.client = new Redis(this.config.redis.url);
    this.client.on('error', (err) =>
      this.logger.error('Redis Client Error:', err),
    );
    this.client.on('connect', () =>
      this.logger.log('Raw Redis Client Connected.'),
    );
  }

  async onModuleDestroy() {
    this.logger.log('Closing raw Redis client connection...');
    await this.client.quit();
  }

  // Method to provide the raw client instance for the Factory below.
  getRawClient(): Redis {
    return this.client;
  }
}

// 2. PROVIDER DEFINITION: The configuration object for NestJS.
export const RawRedisClientDefinition: Provider = {
  // Use the TOKEN as the provide key
  provide: REDIS_CLIENT,
  // Use the Manager to get the connected client instance
  useFactory: (manager: RedisClientManager) => manager.getRawClient(),
  // Ensure the Manager is instantiated first
  inject: [RedisClientManager],
};
