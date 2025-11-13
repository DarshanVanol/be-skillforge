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
  // Pub/Sub (Broadcast - ALL replicas receive)
  // -------------------------------------------------------------------
  /**
   * Publish a message to a Redis channel (Pub/Sub).
   * ⚠️ ALL replicas subscribed to this channel will receive this message.
   * Use this for broadcasting events (notifications, cache invalidation).
   * For work distribution across replicas, use Redis Streams instead.
   */
  publish(channel: string, message: unknown) {
    const payload =
      typeof message === 'string' ? message : JSON.stringify(message);
    return this.publisher.publish(channel, payload);
  }

  /**
   * Subscribe to a Redis channel (Pub/Sub).
   * ⚠️ WARNING: ALL replicas will receive this message.
   * Use this for broadcasting events, NOT for work distribution.
   * For work distribution, use consumeStream() instead.
   */
  async subscribe(channel: string, callback: (msg: string) => void) {
    await this.subscriber.subscribe(channel);
    this.subscriber.on('message', (ch: string, msg: string) => {
      if (ch === channel) callback(msg);
    });
  }

  // -------------------------------------------------------------------
  // Redis Streams (Competitive Consumption - Only ONE replica processes)
  // -------------------------------------------------------------------
  /**
   * Add a message to a Redis Stream for work distribution.
   * Messages are consumed competitively - only ONE replica will process each message.
   * Perfect for distributing work across multiple replicas.
   *
   * @param streamKey - The stream name
   * @param data - Key-value pairs to add to the stream
   * @returns The message ID
   */
  async addToStream(
    streamKey: string,
    data: Record<string, string>,
  ): Promise<string> {
    const entries = Object.entries(data).flat();
    const result = await this.client.xadd(streamKey, '*', ...entries);
    return result ?? '';
  }

  /**
   * Consume messages from a Redis Stream using consumer groups.
   * This enables competitive consumption - each message is processed by only ONE replica.
   * Messages are automatically acknowledged after successful processing.
   *
   * @param streamKey - The stream name
   * @param groupName - Consumer group name (all replicas should use the same group)
   * @param consumerName - Unique name for this consumer (typically: `replica-${process.pid}`)
   * @param callback - Function to process messages (should be async)
   * @param options - Configuration options
   */
  async consumeStream(
    streamKey: string,
    groupName: string,
    consumerName: string,
    callback: (
      messages: Array<{ id: string; data: Record<string, string> }>,
    ) => Promise<void>,
    options: {
      count?: number; // Max messages to fetch per read (default: 10)
      blockMs?: number; // Block time in ms (default: 5000)
    } = {},
  ): Promise<void> {
    const { count = 10, blockMs = 5000 } = options;

    // Create consumer group if it doesn't exist
    try {
      await this.client.xgroup('CREATE', streamKey, groupName, '0', 'MKSTREAM');
      this.logger.log(
        `Created consumer group '${groupName}' for stream '${streamKey}'`,
      );
    } catch (error: unknown) {
      const err = error as Error;
      if (!err.message?.includes('BUSYGROUP')) {
        this.logger.error(`Error creating consumer group: ${err.message}`);
        throw error;
      }
      // Group already exists, continue
    }

    // Consume messages in a loop
    this.logger.log(
      `Consumer '${consumerName}' started consuming from stream '${streamKey}' in group '${groupName}'`,
    );

    while (true) {
      try {
        const result = (await this.client.xreadgroup(
          'GROUP',
          groupName,
          consumerName,
          'COUNT',
          count,
          'BLOCK',
          blockMs,
          'STREAMS',
          streamKey,
          '>',
        )) as [string, [string, string[]][]][] | null;

        if (result && result.length > 0) {
          const [, messages] = result[0];
          const parsedMessages = messages.map((msg: [string, string[]]) => {
            const [id, fields] = msg;
            const data: Record<string, string> = {};
            for (let i = 0; i < fields.length; i += 2) {
              data[fields[i]] = fields[i + 1];
            }
            return { id, data };
          });

          // Process messages
          await callback(parsedMessages);

          // Acknowledge processed messages
          const ids = parsedMessages.map((m) => m.id);
          await this.client.xack(streamKey, groupName, ...ids);
        }
      } catch (error: unknown) {
        const err = error as Error;
        this.logger.error(`Error consuming stream: ${err.message}`, err.stack);
        // Continue consuming despite errors
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  /**
   * Get pending messages for a consumer group (messages that were read but not acknowledged).
   * Useful for recovering from failures.
   */
  async getPendingMessages(
    streamKey: string,
    groupName: string,
  ): Promise<Array<{ id: string; consumer: string; idleTime: number }>> {
    const pending = await this.client.xpending(streamKey, groupName);
    if (!pending || !Array.isArray(pending) || pending.length === 0) return [];

    const count = pending[0] as number;
    if (count === 0) return [];

    const details = (await this.client.xpending(
      streamKey,
      groupName,
      '-',
      '+',
      count,
    )) as [string, string, number][];

    return details.map((item: [string, string, number]) => ({
      id: item[0],
      consumer: item[1],
      idleTime: item[2],
    }));
  }

  /**
   * Claim pending messages that have been idle for too long.
   * Useful for handling consumer failures.
   */
  async claimPendingMessages(
    streamKey: string,
    groupName: string,
    consumerName: string,
    minIdleTimeMs: number,
  ): Promise<number> {
    const pending = await this.getPendingMessages(streamKey, groupName);
    const stuckMessages = pending.filter((m) => m.idleTime >= minIdleTimeMs);

    if (stuckMessages.length === 0) return 0;

    const ids = stuckMessages.map((m) => m.id);
    await this.client.xclaim(
      streamKey,
      groupName,
      consumerName,
      minIdleTimeMs,
      ...ids,
    );

    this.logger.log(
      `Claimed ${ids.length} stuck messages for consumer '${consumerName}'`,
    );
    return ids.length;
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
