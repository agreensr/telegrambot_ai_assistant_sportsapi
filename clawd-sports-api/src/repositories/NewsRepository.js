/**
 * News Repository
 * Handles sports news article persistence.
 *
 * Key Operations:
 * - Get latest news by sport
 * - Search news by keywords
 * - Sync news from ESPN API
 */

import { BaseRepository } from './BaseRepository.js';
import { generateCacheKey, cacheClient } from '../config/cache.js';
import { logger } from '../utils/logger.js';

export class NewsRepository extends BaseRepository {
  constructor() {
    super('news');
  }

  /**
   * Find article by ESPN ID
   */
  async findByEspnId(espnId) {
    const articles = await this.findBy('espn_id', String(espnId));
    return articles[0] || null;
  }

  /**
   * Get latest news for a sport
   */
  async getLatest(sport, limit = 25) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select('*')
        .eq('sport', sport)
        .order('published_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('News getLatest error:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('News getLatest exception:', error);
      return [];
    }
  }

  /**
   * Get news since a specific date
   */
  async getSince(sport, since) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select('*')
        .eq('sport', sport)
        .gte('published_at', since.toISOString())
        .order('published_at', { ascending: false });

      if (error) {
        logger.error('News getSince error:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('News getSince exception:', error);
      return [];
    }
  }

  /**
   * Get news for a date range
   */
  async getByDateRange(sport, startDate, endDate) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select('*')
        .eq('sport', sport)
        .gte('published_at', startDate.toISOString())
        .lte('published_at', endDate.toISOString())
        .order('published_at', { ascending: false });

      if (error) {
        logger.error('News getByDateRange error:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('News getByDateRange exception:', error);
      return [];
    }
  }

  /**
   * Search news by headline or description
   */
  async search(sport, query, limit = 20) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select('*')
        .eq('sport', sport)
        .or(`headline.ilike.%${query}%,description.ilike.%${query}%`)
        .order('published_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('News search error:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('News search exception:', error);
      return [];
    }
  }

  /**
   * Upsert article from ESPN API data
   * Maps ESPN article data to database schema
   */
  async upsertFromESPN(articleData, sport) {
    const article = {
      espn_id: articleData.espnId,
      sport: sport,
      headline: articleData.headline,
      description: articleData.description || null,
      story_url: articleData.storyUrl || null,
      image_url: articleData.imageUrl || null,
      published_at: articleData.publishedAt || null
    };

    return await this.upsert(article, 'espn_id');
  }

  /**
   * Sync news from ESPN API response
   */
  async syncFromESPN(articlesData, sport) {
    const results = [];
    const failed = [];

    for (const articleData of articlesData || []) {
      try {
        const result = await this.upsertFromESPN(articleData, sport);
        if (result) {
          results.push(result);
        } else {
          failed.push(articleData.espnId);
        }
      } catch (error) {
        logger.error(`Failed to sync article ${articleData.espnId}:`, error);
        failed.push(articleData.espnId);
      }
    }

    // Clear news cache for this sport
    await this._clearNewsCache(sport);

    return {
      successful: results.length,
      failed: failed.length,
      total: articlesData?.length || 0
    };
  }

  /**
   * Get cached news for a sport
   */
  async getCachedNews(sport, limit = 25) {
    const cacheKey = generateCacheKey('news', sport, limit);
    return await cacheClient.get(cacheKey);
  }

  /**
   * Set cached news for a sport
   */
  async setCachedNews(sport, data, limit = 25) {
    const cacheKey = generateCacheKey('news', sport, limit);
    // Cache news for 1 hour
    await cacheClient.set(cacheKey, data, 3600);
  }

  /**
   * Get trending news (most recent in last 24 hours)
   */
  async getTrending(sport, limit = 10) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    return await this.getSince(sport, yesterday).then(news =>
      news.slice(0, limit)
    );
  }

  /**
   * Clean up old news (older than 30 days)
   */
  async cleanup(daysToKeep = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const { data, error } = await supabase
        .from(this.tableName)
        .delete()
        .lt('published_at', cutoffDate.toISOString())
        .select('id');

      if (error) {
        logger.error('News cleanup error:', error);
        return { deleted: 0 };
      }

      const deleted = data?.length || 0;
      logger.info(`Cleaned up ${deleted} old news articles`);

      return { deleted };
    } catch (error) {
      logger.error('News cleanup exception:', error);
      return { deleted: 0 };
    }
  }

  /**
   * Clear news cache for a sport
   */
  async _clearNewsCache(sport) {
    await cacheClient.delPattern(`news:${sport}:*`);
  }
}

// Import supabase
import { supabase } from '../config/database.js';

// Export singleton instance
export const newsRepository = new NewsRepository();

export default NewsRepository;
