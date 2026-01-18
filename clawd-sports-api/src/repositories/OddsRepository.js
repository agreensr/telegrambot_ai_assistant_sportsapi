/**
 * Odds Repository
 * Handles betting odds persistence with time-series tracking.
 *
 * Key Operations:
 * - Get current odds by game
 * - Get odds history for a game
 * - Get best odds across sportsbooks
 * - Sync odds from The Odds API
 */

import { BaseRepository } from './BaseRepository.js';
import { supabase } from '../config/database.js';
import { generateCacheKey, cacheClient } from '../config/cache.js';
import { gamesRepository } from './GamesRepository.js';
import { logger } from '../utils/logger.js';

export class OddsRepository extends BaseRepository {
  constructor() {
    super('odds');
  }

  /**
   * Get current odds for a game
   */
  async getByGame(gameId) {
    return await this.findBy('game_id', gameId);
  }

  /**
   * Get odds for a game by market type
   */
  async getByGameAndMarket(gameId, marketType) {
    return await this.findWhere({
      game_id: gameId,
      market_type: marketType
    });
  }

  /**
   * Get odds for a game by sportsbook
   */
  async getByGameAndSportsbook(gameId, sportsbook) {
    return await this.findWhere({
      game_id: gameId,
      sportsbook: sportsbook
    });
  }

  /**
   * Get specific odds (game, sportsbook, market)
   */
  async findSpecific(gameId, sportsbook, marketType) {
    const odds = await this.findWhere({
      game_id: gameId,
      sportsbook,
      market_type: marketType
    });
    return odds[0] || null;
  }

  /**
   * Get odds by sport with game data
   */
  async getBySport(sport) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select(`
          *,
          game:games(*)
        `)
        .eq('game->>sport', sport)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Odds getBySport error:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('Odds getBySport exception:', error);
      return [];
    }
  }

  /**
   * Get all unique sportsbooks
   */
  async getSportsbooks() {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select('sportsbook')
        .not('sportsbook', 'is', null);

      if (error) {
        logger.error('Odds getSportsbooks error:', error);
        return [];
      }

      // Get unique sportsbooks
      const sportsbooks = [...new Set(data?.map(o => o.sportsbook) || [])];
      return sportsbooks.sort();
    } catch (error) {
      logger.error('Odds getSportsbooks exception:', error);
      return [];
    }
  }

  /**
   * Get odds history for a game (time series)
   */
  async getHistory(gameId, marketType = null, sportsbook = null) {
    try {
      // Note: This requires a separate odds_history table for true time-series
      // For now, return current odds
      const filters = { game_id: gameId };
      if (marketType) filters.market_type = marketType;
      if (sportsbook) filters.sportsbook = sportsbook;

      return await this.findWhere(filters, {
        orderBy: 'created_at',
        ascending: false
      });
    } catch (error) {
      logger.error('Odds getHistory exception:', error);
      return [];
    }
  }

  /**
   * Get best odds across sportsbooks for a game
   */
  async getBestOdds(gameId, marketType = 'h2h') {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select('*')
        .eq('game_id', gameId)
        .eq('market_type', marketType);

      if (error) {
        logger.error('Odds getBestOdds error:', error);
        return null;
      }

      if (!data || data.length === 0) {
        return null;
      }

      // Find best odds for each outcome
      const bestHome = data.reduce((best, current) =>
        (current.home_odds > (best?.home_odds || 0)) ? current : best
      , null);

      const bestAway = data.reduce((best, current) =>
        (current.away_odds > (best?.away_odds || 0)) ? current : best
      , null);

      return {
        home: {
          odds: bestHome?.home_odds,
          sportsbook: bestHome?.sportsbook
        },
        away: {
          odds: bestAway?.away_odds,
          sportsbook: bestAway?.sportsbook
        }
      };
    } catch (error) {
      logger.error('Odds getBestOdds exception:', error);
      return null;
    }
  }

  /**
   * Upsert odds from The Odds API data
   * Maps API odds data to database schema
   */
  async upsertFromOddsAPI(oddsData, league) {
    // Find or create game
    let game = await gamesRepository.findByEspnId(String(oddsData.id));

    // If game not found by ESPN ID, try to match by teams and date
    if (!game && oddsData.home_team && oddsData.away_team) {
      // This is a fallback - ideally games are created first
      logger.warn(`Game not found for odds: ${oddsData.id}`);
    }

    if (!game) {
      return null;
    }

    const results = [];

    // Process each bookmaker
    for (const bookmaker of oddsData.bookmakers || []) {
      const sportsbook = bookmaker.title;

      // Process each market type
      for (const market of bookmaker.markets || []) {
        const marketType = market.key; // h2h, spreads, totals

        // Extract odds based on market type
        let oddsRecord = null;

        if (marketType === 'h2h') {
          // Moneyline odds
          const homeOutcome = market.outcomes?.find(o => o.name === oddsData.home_team);
          const awayOutcome = market.outcomes?.find(o => o.name === oddsData.away_team);

          if (homeOutcome && awayOutcome) {
            oddsRecord = {
              game_id: game.id,
              sportsbook,
              market_type: 'h2h',
              home_odds: homeOutcome.price,
              away_odds: awayOutcome.price,
              home_spread: null,
              away_spread: null,
              total_over: null,
              total_under: null,
              last_update: new Date().toISOString()
            };
          }
        } else if (marketType === 'spreads') {
          // Point spread odds
          const homeOutcome = market.outcomes?.find(o => o.name === oddsData.home_team);
          const awayOutcome = market.outcomes?.find(o => o.name === oddsData.away_team);

          if (homeOutcome && awayOutcome) {
            oddsRecord = {
              game_id: game.id,
              sportsbook,
              market_type: 'spreads',
              home_odds: homeOutcome.price || null,
              away_odds: awayOutcome.price || null,
              home_spread: Math.abs(homeOutcome.point || 0),
              away_spread: -(awayOutcome.point || 0),
              total_over: null,
              total_under: null,
              last_update: new Date().toISOString()
            };
          }
        } else if (marketType === 'totals') {
          // Over/under odds
          const overOutcome = market.outcomes?.find(o => o.name === 'Over');
          const underOutcome = market.outcomes?.find(o => o.name === 'Under');

          if (overOutcome && underOutcome) {
            oddsRecord = {
              game_id: game.id,
              sportsbook,
              market_type: 'totals',
              home_odds: null,
              away_odds: null,
              home_spread: null,
              away_spread: null,
              total_over: overOutcome.point,
              total_under: underOutcome.point,
              last_update: new Date().toISOString()
            };
          }
        }

        if (oddsRecord) {
          const result = await this.upsert(oddsRecord, ['game_id', 'sportsbook', 'market_type']);
          if (result) {
            results.push(result);
          }
        }
      }
    }

    // Clear odds cache
    await this._clearOddsCache(league);

    return results;
  }

  /**
   * Sync odds from The Odds API response
   */
  async syncFromOddsAPI(oddsArray, league) {
    const results = [];
    const failed = [];

    for (const oddsData of oddsArray || []) {
      try {
        const synced = await this.upsertFromOddsAPI(oddsData, league);
        if (synced && synced.length > 0) {
          results.push(...synced);
        } else {
          failed.push(oddsData.id);
        }
      } catch (error) {
        logger.error(`Failed to sync odds for game ${oddsData.id}:`, error);
        failed.push(oddsData.id);
      }
    }

    return {
      successful: results.length,
      failed: failed.length,
      total: oddsArray?.length || 0
    };
  }

  /**
   * Get cached odds for a league
   */
  async getCachedOdds(sport) {
    const cacheKey = generateCacheKey('odds', sport);
    return await cacheClient.get(cacheKey);
  }

  /**
   * Set cached odds for a league
   */
  async setCachedOdds(sport, data) {
    const cacheKey = generateCacheKey('odds', sport);
    // Cache odds for 5 minutes
    await cacheClient.set(cacheKey, data, 300);
  }

  /**
   * Get current odds with aggregations by market
   */
  async getAggregatedOdds(gameId) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select('*')
        .eq('game_id', gameId);

      if (error) {
        logger.error('Odds getAggregatedOdds error:', error);
        return null;
      }

      if (!data || data.length === 0) {
        return null;
      }

      // Aggregate by market type
      const aggregated = {
        h2h: [],
        spreads: [],
        totals: []
      };

      for (const odds of data) {
        if (aggregated[odds.market_type]) {
          aggregated[odds.market_type].push({
            sportsbook: odds.sportsbook,
            homeOdds: odds.home_odds,
            awayOdds: odds.away_odds,
            homeSpread: odds.home_spread,
            awaySpread: odds.away_spread,
            totalOver: odds.total_over,
            totalUnder: odds.total_under,
            lastUpdate: odds.last_update
          });
        }
      }

      return aggregated;
    } catch (error) {
      logger.error('Odds getAggregatedOdds exception:', error);
      return null;
    }
  }

  /**
   * Clear odds cache for a sport
   */
  async _clearOddsCache(sport) {
    await cacheClient.delPattern(`odds:${sport}:*`);
  }
}

// Export singleton instance
export const oddsRepository = new OddsRepository();

export default OddsRepository;
