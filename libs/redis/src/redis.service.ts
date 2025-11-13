import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import Redis, { Cluster } from 'ioredis';
import {
  REDIS_CLIENT,
  REDIS_PUBLISHER,
  REDIS_SUBSCRIBER,
} from './redis-client.provider';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);

  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    @Inject(REDIS_CLIENT) private readonly client: Redis | Cluster,
    @Inject(REDIS_PUBLISHER) private readonly publisher: Redis | Cluster,
    @Inject(REDIS_SUBSCRIBER) private readonly subscriber: Redis | Cluster,
  ) {}

  // -------------------------------------------------------------------
  // Cache Manager
  // -------------------------------------------------------------------
  async set<T>(key: string, value: T, ttlSeconds?: number) {
    await this.cache.set(key, value, ttlSeconds ? ttlSeconds : undefined);
  }

  async get<T>(key: string): Promise<T | null> {
    return (await this.cache.get<T>(key)) ?? null;
  }

  async del(key: string) {
    return this.cache.del(key);
  }

  // -------------------------------------------------------------------
  // Raw Redis
  // -------------------------------------------------------------------
  incr(key: string) {
    return this.client.incr(key);
  }

  hSet(key: string, field: string, value: string) {
    return this.client.hset(key, field, value);
  }

  hGetAll(key: string) {
    return this.client.hgetall(key);
  }

  // -------------------------------------------------------------------
  // Pub/Sub
  // -------------------------------------------------------------------
  publish(channel: string, message: unknown) {
    const payload =
      typeof message === 'string' ? message : JSON.stringify(message);
    return this.publisher.publish(channel, payload);
  }

  async subscribe(channel: string, callback: (msg: string) => void) {
    await this.subscriber.subscribe(channel);
    this.subscriber.on('message', (ch: string, msg: string) => {
      if (ch === channel) callback(msg);
    });
  }

  // -------------------------------------------------------------------
  // DISTRIBUTED RATE LIMITER (per user / IP / route)
  // -------------------------------------------------------------------
  async rateLimit(key: string, limit: number, windowSec: number) {
    const now = Date.now();
    const resetAt = Math.floor(now / 1000) + windowSec;

    const count = await this.client.incr(key);
    if (count === 1) {
      await this.client.expire(key, windowSec);
    }

    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetAt,
    };
  }

  // -------------------------------------------------------------------
  // Health check
  // -------------------------------------------------------------------
  async healthCheck() {
    try {
      await this.client.ping();
      return { status: 'up' };
    } catch (e) {
      return { status: 'down', error: String(e) };
    }
  }
}
