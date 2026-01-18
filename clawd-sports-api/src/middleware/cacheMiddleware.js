/**
 * Caching Middleware
 * Express middleware for caching API responses with automatic TTL management.
 *
 * Usage:
 * - Apply to GET routes that should be cached
 * - Automatically caches responses and serves from cache on subsequent requests
 * - Respects Cache-Control headers from clients
 */

import { generateCacheKey, cacheClient, CACHE_TTL } from '../config/cache.js';
import { logger } from '../utils/logger.js';

/**
 * Cache middleware factory
 * @param {string} dataType - Data type for TTL selection (scores, odds, standings, etc.)
 * @param {Object} options - Configuration options
 */
export function cacheMiddleware(dataType, options = {}) {
  const {
    keyGenerator = null, // Custom cache key generator function
    ttl = null, // Custom TTL (overrides dataType default)
    enabled = true // Enable/disable caching
  } = options;

  return async (req, res, next) => {
    // Skip caching if disabled
    if (!enabled) {
      return next();
    }

    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip caching if client has Cache-Control: no-cache
    if (req.headers['cache-control'] === 'no-cache') {
      return next();
    }

    try {
      // Generate cache key
      const cacheKey = keyGenerator
        ? keyGenerator(req)
        : generateCacheKey(dataType, req.path, req.query);

      // Check cache
      const cached = await cacheClient.get(cacheKey);

      if (cached !== null) {
        logger.debug(`Cache hit: ${cacheKey}`);

        // Set cache header
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('Content-Type', 'application/json');

        return res.json(cached);
      }

      logger.debug(`Cache miss: ${cacheKey}`);

      // Store original json method
      const originalJson = res.json.bind(res);

      // Override json method to cache response
      res.json = function(data) {
        // Cache the response
        const cacheTtl = ttl || CACHE_TTL[dataType] || 300;
        cacheClient.set(cacheKey, data, cacheTtl).catch(err => {
          logger.error('Cache set error:', err);
        });

        // Set cache header
        res.setHeader('X-Cache', 'MISS');

        // Call original json method
        return originalJson(data);
      };

      next();
    } catch (error) {
      logger.error('Cache middleware error:', error);
      // Continue without caching on error
      next();
    }
  };
}

/**
 * Cache invalidation middleware
 * Invalidates cache patterns after mutations
 */
export function invalidateCache(pattern) {
  return async (req, res, next) => {
    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to invalidate cache after response
    res.json = function(data) {
      // Invalidate cache pattern
      cacheClient.delPattern(pattern).catch(err => {
        logger.error('Cache invalidation error:', err);
      });

      return originalJson(data);
    };

    next();
  };
}

/**
 * Conditional cache middleware
 * Caches based on a condition function
 */
export function cacheIf(conditionFn, dataType, options = {}) {
  return async (req, res, next) => {
    if (await conditionFn(req)) {
      return cacheMiddleware(dataType, options)(req, res, next);
    }
    next();
  };
}

/**
 * Cache key generator for league-based routes
 */
export function leagueCacheKey(req) {
  const league = req.params.league || req.query.league;
  const path = req.path;
  const query = new URLSearchParams(req.query).toString();

  return generateCacheKey('api', league, path, query);
}

/**
 * Cache key generator for parameterized routes
 */
export function paramCacheKey(...paramNames) {
  return (req) => {
    const params = paramNames.map(name => req.params[name] || req.query[name]);
    return generateCacheKey('api', req.path, ...params);
  };
}

/**
 * Cache control header middleware
 * Adds Cache-Control headers to responses
 */
export function cacheControl(maxAge = 300, options = {}) {
  const {
    mustRevalidate = false,
    staleWhileRevalidate = null,
    staleIfError = null
  } = options;

  return (req, res, next) => {
    const directives = [`max-age=${maxAge}`];

    if (mustRevalidate) {
      directives.push('must-revalidate');
    }

    if (staleWhileRevalidate !== null) {
      directives.push(`stale-while-revalidate=${staleWhileRevalidate}`);
    }

    if (staleIfError !== null) {
      directives.push(`stale-if-error=${staleIfError}`);
    }

    res.setHeader('Cache-Control', directives.join(', '));
    next();
  };
}

/**
 * Bypass cache middleware
 * Forces cache bypass for this request
 */
export function bypassCache(req, res, next) {
  req.bypassCache = true;
  res.setHeader('X-Cache-Bypass', 'true');
  next();
}

/**
 * Cache stats middleware
 * Adds cache statistics to response
 */
export function cacheStats(req, res, next) {
  const originalJson = res.json.bind(res);

  res.json = function(data) {
    // Add cache stats if in development mode
    if (process.env.NODE_ENV === 'development') {
      cacheClient.getStats().then(stats => {
        if (stats) {
          res.setHeader('X-Cache-Stats', JSON.stringify(stats));
        }
      }).catch(() => {
        // Ignore stats errors
      });
    }

    return originalJson(data);
  };

  next();
}

/**
 * Predefined cache middleware for common data types
 */
export const cacheScores = () => cacheMiddleware('scores', { keyGenerator: leagueCacheKey });
export const cacheOdds = () => cacheMiddleware('odds', { keyGenerator: leagueCacheKey });
export const cacheStandings = () => cacheMiddleware('standings', { keyGenerator: leagueCacheKey });
export const cacheNews = () => cacheMiddleware('news', { keyGenerator: leagueCacheKey });

export default {
  cacheMiddleware,
  invalidateCache,
  cacheIf,
  leagueCacheKey,
  paramCacheKey,
  cacheControl,
  bypassCache,
  cacheStats,
  cacheScores,
  cacheOdds,
  cacheStandings,
  cacheNews
};
