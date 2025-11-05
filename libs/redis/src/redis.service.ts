import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager'; // Type for high-level caching interface
import Redis from 'ioredis'; // Type for the raw client
import { REDIS_CLIENT } from './redis-client.provider';

/**
 * The RedisService acts as the primary interface for all Redis interactions
 * within the application, abstracting away the Cache Manager and the raw ioredis client.
 */
@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);
  /**
   * @param cacheManager The high-level NestJS Cache interface for simple GET/SET/DEL operations.
   * @param rawClient The raw ioredis client for advanced operations (Pub/Sub, Hashes, Lists, etc.).
   */
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @Inject(REDIS_CLIENT) private rawClient: Redis,
  ) {
    // Optional: Log successful injection
    this.logger.log(
      'RedisService initialized. Cache Manager and Raw Client available.',
    );
  }

  // --- 1. HIGH-LEVEL CACHING METHODS (Using NestJS Cache Manager) ---

  /**
   * Stores a value under a key with an optional time-to-live (TTL).
   * @param key The cache key.
   * @param value The value to store.
   * @param ttlSeconds The TTL in seconds. If 0 or undefined, uses default.
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const ttlMilliseconds = ttlSeconds ? ttlSeconds * 1000 : undefined;

    // The cache manager usually handles serialization/deserialization for basic types
    await this.cacheManager.set(key, value, ttlMilliseconds);
  }

  /**
   * Retrieves a value by key.
   * @param key The cache key.
   * @returns The cached value or null if not found.
   */
  async get<T>(key: string): Promise<T | null> {
    const value = await this.cacheManager.get<T>(key);
    return value || null;
  }

  /**
   * Deletes a key from the cache.
   * @param key The cache key to delete.
   */
  async del(key: string): Promise<void> {
    await this.cacheManager.del(key);
  }

  /**
   * Increments the number stored at key by one.
   * @param key The cache key.
   */
  async incr(key: string): Promise<number> {
    // Note: cache-manager doesn't always expose INCR directly,
    // but the underlying store (ioredis) does. For simplicity and robustness,
    // we use the raw client for operations like INCR/DECR.
    return this.rawClient.incr(key);
  }

  // --- 2. RAW CLIENT ACCESS (For Advanced Operations) ---

  /**
   * Exposes the raw ioredis client instance.
   * Use this for complex operations like Pub/Sub, Pipelines, or ZSET/HSET commands.
   */
  getRawClient(): Redis {
    return this.rawClient;
  }

  // --- 3. ADVANCED WRAPPER METHODS (Using Raw Client) ---

  /**
   * Retrieves all fields and values of the hash stored at key.
   * @param key The hash key.
   */
  async hGetAll(key: string): Promise<Record<string, string>> {
    return this.rawClient.hgetall(key);
  }

  /**
   * Sets the specified fields to their respective values in the hash stored at key.
   * @param key The hash key.
   * @param field The field name.
   * @param value The field value.
   */
  async hSet(key: string, field: string, value: string): Promise<number> {
    return this.rawClient.hset(key, field, value);
  }

  /**
   * Publishes a message to the specified channel.
   * @param channel The channel name.
   * @param message The message content (string).
   * @returns The number of clients that received the message.
   */
  async publish(channel: string, message: string): Promise<number> {
    return this.rawClient.publish(channel, message);
  }
}
