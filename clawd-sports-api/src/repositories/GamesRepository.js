/**
 * Games Repository
 * Handles game data persistence with team relationships.
 *
 * Key Operations:
 * - Find games by status (live, upcoming, completed)
 * - Find games by date range
 * - Find games by team
 * - Sync games from ESPN scoreboard
 */

import { BaseRepository } from './BaseRepository.js';
import { supabase } from '../config/database.js';
import { generateCacheKey, cacheClient } from '../config/cache.js';
import { teamsRepository } from './TeamsRepository.js';
import { logger } from '../utils/logger.js';

export class GamesRepository extends BaseRepository {
  constructor() {
    super('games');
  }

  /**
   * Find game by ESPN ID
   */
  async findByEspnId(espnId) {
    const games = await this.findBy('espn_id', String(espnId));
    return games[0] || null;
  }

  /**
   * Get live games (status: in)
   */
  async getLive(sport = null) {
    const filters = sport ? { sport, status: 'in' } : { status: 'in' };
    return await this.findWhere(filters, {
      orderBy: 'start_time',
      ascending: true
    });
  }

  /**
   * Get upcoming games (status: pre)
   */
  async getUpcoming(sport = null, limit = 50) {
    const filters = sport ? { sport, status: 'pre' } : { status: 'pre' };
    return await this.findWhere(filters, {
      orderBy: 'start_time',
      ascending: true,
      limit
    });
  }

  /**
   * Get completed games (status: post)
   */
  async getCompleted(sport = null, limit = 100) {
    const filters = sport ? { sport, status: 'post' } : { status: 'post' };
    return await this.findWhere(filters, {
      orderBy: 'start_time',
      ascending: false,
      limit
    });
  }

  /**
   * Get games by date range
   */
  async getByDateRange(sport, startDate, endDate) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select('*')
        .eq('sport', sport)
        .gte('start_time', startDate.toISOString())
        .lte('start_time', endDate.toISOString())
        .order('start_time', { ascending: true });

      if (error) {
        logger.error('Games getByDateRange error:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('Games getByDateRange exception:', error);
      return [];
    }
  }

  /**
   * Get games by team
   */
  async getByTeam(teamId, options = {}) {
    try {
      let query = supabase
        .from(this.tableName)
        .select('*')
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`);

      // Filter by status if specified
      if (options.status) {
        query = query.eq('status', options.status);
      }

      // Filter by date range if specified
      if (options.startDate) {
        query = query.gte('start_time', options.startDate.toISOString());
      }
      if (options.endDate) {
        query = query.lte('start_time', options.endDate.toISOString());
      }

      // Apply ordering and limit
      query = query.order('start_time', { ascending: options.ascending ?? false });

      if (options.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Games getByTeam error:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('Games getByTeam exception:', error);
      return [];
    }
  }

  /**
   * Get games with full team data
   */
  async getWithTeams(sport = null, status = null) {
    try {
      let query = supabase
        .from(this.tableName)
        .select(`
          *,
          home_team:teams!games_home_team_id_fkey(*),
          away_team:teams!games_away_team_id_fkey(*)
        `);

      if (sport) {
        query = query.eq('sport', sport);
      }
      if (status) {
        query = query.eq('status', status);
      }

      query = query.order('start_time', { ascending: true });

      const { data, error } = await query;

      if (error) {
        logger.error('Games getWithTeams error:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('Games getWithTeams exception:', error);
      return [];
    }
  }

  /**
   * Upsert game from ESPN API data
   * Maps ESPN game data to database schema
   */
  async upsertFromESPN(espnGameData) {
    // Ensure teams exist and get their IDs
    const homeTeam = await teamsRepository.getOrCreate(
      espnGameData.homeTeam,
      espnGameData.sport
    );
    const awayTeam = await teamsRepository.getOrCreate(
      espnGameData.awayTeam,
      espnGameData.sport
    );

    if (!homeTeam || !awayTeam) {
      logger.warn('Failed to create teams for game:', espnGameData.espnId);
      return null;
    }

    const game = {
      espn_id: espnGameData.espnId,
      sport: espnGameData.sport,
      league: espnGameData.league,
      home_team_id: homeTeam.id,
      away_team_id: awayTeam.id,
      home_score: espnGameData.homeTeam.score,
      away_score: espnGameData.awayTeam.score,
      status: espnGameData.status.type.state, // 'pre', 'in', 'post'
      period: espnGameData.status.period || null,
      clock: espnGameData.status.clock || null,
      start_time: espnGameData.startTime || null,
      venue: espnGameData.venue || null,
      broadcast: espnGameData.broadcast || null
    };

    return await this.upsert(game, 'espn_id');
  }

  /**
   * Sync games from ESPN scoreboard data
   * Upserts all games and ensures teams exist
   */
  async syncFromScoreboard(scoreboardData) {
    const results = [];
    const failed = [];

    for (const game of scoreboardData.games || []) {
      try {
        const result = await this.upsertFromESPN(game);
        if (result) {
          results.push(result);
        } else {
          failed.push(game.espnId);
        }
      } catch (error) {
        logger.error(`Failed to sync game ${game.espnId}:`, error);
        failed.push(game.espnId);
      }
    }

    // Clear cache for this sport
    await this._clearSportCache(scoreboardData.sport);

    return {
      successful: results.length,
      failed: failed.length,
      total: scoreboardData.games?.length || 0
    };
  }

  /**
   * Get cached scoreboard for a league
   * Returns null if not cached
   */
  async getCachedScoreboard(sport) {
    const cacheKey = generateCacheKey('scores', sport);
    return await cacheClient.get(cacheKey);
  }

  /**
   * Set cached scoreboard for a league
   */
  async setCachedScoreboard(sport, data) {
    const cacheKey = generateCacheKey('scores', sport);
    // Cache scores for 30 seconds
    await cacheClient.set(cacheKey, data, 30);
  }

  /**
   * Get live games with scores for display
   */
  async getLiveDisplay(sport) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select(`
          *,
          home_team:teams!games_home_team_id_fkey(id, name, abbreviation, logo_url),
          away_team:teams!games_away_team_id_fkey(id, name, abbreviation, logo_url)
        `)
        .eq('sport', sport)
        .eq('status', 'in')
        .order('start_time', { ascending: true });

      if (error) {
        logger.error('Games getLiveDisplay error:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('Games getLiveDisplay exception:', error);
      return [];
    }
  }

  /**
   * Update game score
   */
  async updateScore(espnId, homeScore, awayScore, status, period, clock) {
    const game = await this.findByEspnId(espnId);
    if (!game) {
      return null;
    }

    const updates = {
      home_score: homeScore,
      away_score: awayScore
    };

    if (status) updates.status = status;
    if (period !== undefined) updates.period = period;
    if (clock !== undefined) updates.clock = clock;

    return await this.update(game.id, updates);
  }

  /**
   * Finalize game (mark as completed)
   */
  async finalize(espnId, finalHomeScore, finalAwayScore) {
    const game = await this.findByEspnId(espnId);
    if (!game) {
      return null;
    }

    return await this.update(game.id, {
      home_score: finalHomeScore,
      away_score: finalAwayScore,
      status: 'post',
      period: null,
      clock: null
    });
  }

  /**
   * Clear cache for a sport
   */
  async _clearSportCache(sport) {
    await cacheClient.delPattern(`scores:${sport}:*`);
    await cacheClient.delPattern(`games:${sport}:*`);
  }
}

// Export singleton instance
export const gamesRepository = new GamesRepository();

export default GamesRepository;
