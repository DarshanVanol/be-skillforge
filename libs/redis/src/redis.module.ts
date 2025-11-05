import { Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { CommonConfigModule, CommonConfigService } from '@app/common-config';
import { CacheModule } from '@nestjs/cache-manager';
import {
  RawRedisClientDefinition,
  REDIS_CLIENT,
  RedisClientManager,
} from './redis-client.provider';

@Module({
  imports: [
    CommonConfigModule,
    // 1. Caching Layer Setup
    CacheModule.registerAsync({
      imports: [CommonConfigModule],
      inject: [CommonConfigService],
      useFactory: (config: CommonConfigService) => ({
        url: config.redis.url,
      }),
    }),
  ],
  providers: [
    RedisService,
    // 1. The Manager class (handles lifecycle)
    RedisClientManager,
    // 2. The Definition constant (provides the token REDIS_CLIENT)
    RawRedisClientDefinition,
  ],
  exports: [RedisService, REDIS_CLIENT],
})
export class RedisModule {}
