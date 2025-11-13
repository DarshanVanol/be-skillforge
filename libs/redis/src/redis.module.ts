import { Global, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { CommonConfigModule, CommonConfigService } from '@app/common-config';
import {
  RedisClientManager,
  RedisClientProviders,
} from './redis-client.provider';
import { RedisService } from './redis.service';
import { RedisHealthController } from './redis.health.controller';
import * as redisStore from 'cache-manager-ioredis';

@Global()
@Module({
  imports: [
    CommonConfigModule,
    CacheModule.registerAsync({
      imports: [CommonConfigModule],
      inject: [CommonConfigService],
      useFactory: (config: CommonConfigService) => ({
        store: redisStore,
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password || undefined,
        tls: config.redis.tls ? {} : undefined,
      }),
    }),
  ],
  controllers: [RedisHealthController],
  providers: [RedisClientManager, ...RedisClientProviders, RedisService],
  exports: [RedisService, ...RedisClientProviders],
})
export class RedisModule {}
