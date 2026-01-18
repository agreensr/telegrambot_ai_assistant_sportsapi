/**
 * Redis Cache Client
 * Provides tiered caching with configurable TTLs for different data types.
 *
 * Cache TTL Configuration (from .env):
 * - Live scores: 30 seconds (real-time updates)
 * - Betting odds: 5 minutes (frequent changes)
 * - Standings: 6 hours (update after games)
 * - Schedules: 1 day (static once set)
 * - Player stats: 7 days (relatively static)
 * - News: 1 hour (content updates)
 */

import Redis from 'ioredis';
import { logger } from '../utils/logger.js';

/**
 * Cache TTL configuration (in seconds)
 */
const CACHE_TTL = {
  scores: parseInt(process.env.CACHE_TTL_SCORES) || 30,
  odds: parseInt(process.env.CACHE_TTL_ODDS) || 300,
  standings: parseInt(process.env.CACHE_TTL_STANDINGS) || 21600,
  schedules: parseInt(process.env.CACHE_TTL_SCHEDULES) || 86400,
  players: parseInt(process.env.CACHE_TTL_PLAYERS) || 604800,
  news: parseInt(process.env.CACHE_TTL_NEWS) || 3600
};

/**
 * Parse Redis connection URL
 * Supports formats: redis://localhost:6379, redis://:password@localhost:6379
 */
function parseRedisUrl(url) {
  if (!url) {
    return {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB) || 0
    };
  }

  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port) || 6379,
      password: parsed.password || undefined,
      db: parsed.pathname ? parseInt(parsed.pathname.slice(1)) : 0
    };
  } catch (error) {
    logger.warn('Invalid Redis URL, falling back to env vars:', error);
    return {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB) || 0
    };
  }
}

/**
 * Redis client singleton
 */
class CacheClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.isHealthy = true;
  }

  /**
   * Initialize Redis connection
   */
  async connect() {
    if (this.client) {
      return this.client;
    }

    try {
      const config = parseRedisUrl(process.env.REDIS_URL);

      this.client = new Redis({
        host: config.host,
        port: config.port,
        password: config.password,
        db: config.db,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          logger.debug(`Redis reconnecting in ${delay}ms (attempt ${times})`);
          return delay;
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: false
      });

      // Event handlers
      this.client.on('connect', () => {
        logger.info('Redis connecting...');
      });

      this.client.on('ready', () => {
        this.isConnected = true;
        this.isHealthy = true;
        logger.info('Redis connection established');
      });

      this.client.on('error', (error) => {
        this.isHealthy = false;
        logger.error('Redis connection error:', error.message);
      });

      this.client.on('close', () => {
        this.isConnected = false;
        logger.warn('Redis connection closed');
      });

      this.client.on('reconnecting', () => {
        logger.info('Redis reconnecting...');
      });

      // Wait for connection
      await this.client.ready;

      return this.client;
    } catch (error) {
      this.isHealthy = false;
      logger.error('Redis connection failed:', error);
      // Return null instead of throwing - allow app to run without cache
      return null;
    }
  }

  /**
   * Get cached value
   */
  async get(key) {
    if (!this.isConnected || !this.client) {
      return null;
    }

    try {
      const value = await this.client.get(key);
      if (!value) {
        return null;
      }

      // Parse JSON if cached value is JSON
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set cached value with TTL
   */
  async set(key, value, ttl = null) {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);

      if (ttl) {
        await this.client.setex(key, ttl, serialized);
      } else {
        await this.client.set(key, serialized);
      }

      return true;
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete cached value
   */
  async del(key) {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete keys matching pattern
   */
  async delPattern(pattern) {
    if (!this.isConnected || !this.client) {
      return 0;
    }

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }

      await this.client.del(...keys);
      return keys.length;
    } catch (error) {
      logger.error(`Cache delete pattern error for ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Clear all cache (use with caution)
   */
  async flush() {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      await this.client.flushdb();
      logger.info('Cache flushed');
      return true;
    } catch (error) {
      logger.error('Cache flush error:', error);
      return false;
    }
  }

  /**
   * Check cache health
   */
  async healthCheck() {
    if (!this.isConnected || !this.client) {
      return {
        status: 'unhealthy',
        connected: false,
        message: 'Not connected'
      };
    }

    try {
      const startTime = Date.now();
      await this.client.ping();
      const latency = Date.now() - startTime;

      return {
        status: 'healthy',
        connected: true,
        latency
      };
    } catch (error) {
      this.isHealthy = false;
      return {
        status: 'unhealthy',
        connected: false,
        error: error.message
      };
    }
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    if (!this.isConnected || !this.client) {
      return null;
    }

    try {
      const info = await this.client.info('stats');
      const dbSize = await this.client.dbsize();

      return {
        totalKeys: dbSize,
        stats: info
      };
    } catch (error) {
      logger.error('Cache stats error:', error);
      return null;
    }
  }

  /**
   * Close Redis connection
   */
  async close() {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
    }
  }
}

/**
 * Export singleton instance
 */
export const cacheClient = new CacheClient();

/**
 * Initialize cache connection
 */
export async function initCache() {
  return await cacheClient.connect();
}

/**
 * Health check for cache
 */
export async function healthCheck() {
  return await cacheClient.healthCheck();
}

/**
 * Generate cache key with namespace
 */
export function generateCacheKey(namespace, ...parts) {
  const sanitizedParts = parts.map(part =>
    String(part).replace(/[^a-zA-Z0-9_-]/g, '_')
  );
  return `${namespace}:${sanitizedParts.join(':')}`;
}

/**
 * Cache helper with automatic TTL selection
 */
export class CacheHelper {
  /**
   * Get or set pattern with automatic TTL
   */
  static async getOrSet(key, fetchFn, dataType) {
    // Try cache first
    const cached = await cacheClient.get(key);
    if (cached !== null) {
      logger.debug(`Cache hit: ${key}`);
      return { data: cached, cached: true };
    }

    // Cache miss - fetch data
    logger.debug(`Cache miss: ${key}`);
    const data = await fetchFn();

    // Set in cache with appropriate TTL
    const ttl = CACHE_TTL[dataType] || 300;
    await cacheClient.set(key, data, ttl);

    return { data, cached: false };
  }

  /**
   * Invalidate cache by pattern
   */
  static async invalidate(pattern) {
    const count = await cacheClient.delPattern(pattern);
    logger.info(`Invalidated ${count} cache entries matching: ${pattern}`);
    return count;
  }
}

/**
 * Export TTL configuration
 */
export { CACHE_TTL };

export default cacheClient;
