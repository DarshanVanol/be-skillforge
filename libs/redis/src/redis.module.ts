import { Global, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { CommonConfigModule, CommonConfigService } from '@app/common-config';
import {
  RedisClientManager,
  RedisClientProviders,
} from './redis-client.provider';
import { RedisService } from './redis.service';
import { RedisHealthController } from './redis.health.controller';

@Global()
@Module({
  imports: [
    CommonConfigModule,
    CacheModule.registerAsync({
      imports: [CommonConfigModule],
      inject: [CommonConfigService],
      useFactory: (config: CommonConfigService) => ({
        url: config.redis.url,
      }),
    }),
  ],
  controllers: [RedisHealthController],
  providers: [RedisClientManager, ...RedisClientProviders, RedisService],
  exports: [RedisService, ...RedisClientProviders],
})
export class RedisModule {}
