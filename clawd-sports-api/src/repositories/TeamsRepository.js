/**
 * Teams Repository
 * Handles team data persistence with ESPN ID integration.
 *
 * Key Operations:
 * - Find team by ESPN ID (primary lookup)
 * - Find teams by league/sport
 * - Bulk upsert teams from API data
 */

import { BaseRepository } from './BaseRepository.js';
import { generateCacheKey, cacheClient } from '../config/cache.js';
import { supabase } from '../config/database.js';

export class TeamsRepository extends BaseRepository {
  constructor() {
    super('teams');
  }

  /**
   * Find team by ESPN ID
   */
  async findByEspnId(espnId) {
    const teams = await this.findBy('espn_id', String(espnId));
    return teams[0] || null;
  }

  /**
   * Find all teams for a league
   */
  async findByLeague(league) {
    return await this.findBy('league', league, {
      orderBy: 'name',
      ascending: true
    });
  }

  /**
   * Find all teams for a sport
   */
  async findBySport(sport) {
    return await this.findBy('sport', sport, {
      orderBy: 'name',
      ascending: true
    });
  }

  /**
   * Find team by abbreviation for a league
   */
  async findByAbbreviation(abbreviation, league) {
    const teams = await this.findWhere(
      { abbreviation: abbreviation.toUpperCase(), league },
      { limit: 1 }
    );
    return teams[0] || null;
  }

  /**
   * Upsert team from ESPN API data
   * Maps ESPN team data to database schema
   */
  async upsertFromESPN(espnTeamData, league) {
    const team = {
      espn_id: String(espnTeamData.espnId || espnTeamData.id),
      sport: league,
      league: this._getLeagueName(league),
      name: espnTeamData.name,
      abbreviation: espnTeamData.abbreviation || null,
      location: espnTeamData.location || null,
      logo_url: espnTeamData.logo || null,
      color: espnTeamData.color || null,
      alternate_color: espnTeamData.alternateColor || null
    };

    return await this.upsert(team, 'espn_id');
  }

  /**
   * Bulk upsert teams from ESPN scoreboard data
   * Extracts teams from game data and upserts them
   */
  async syncFromScoreboard(scoreboardData) {
    const teamsMap = new Map();

    // Extract unique teams from games
    for (const game of scoreboardData.games || []) {
      if (game.homeTeam) {
        const key = `${game.homeTeam.espnId}_${game.league}`;
        if (!teamsMap.has(key)) {
          teamsMap.set(key, {
            espnId: game.homeTeam.espnId,
            name: game.homeTeam.name,
            abbreviation: game.homeTeam.abbreviation,
            location: game.homeTeam.location || null,
            logo: game.homeTeam.logo,
            sport: game.sport,
            league: game.league
          });
        }
      }

      if (game.awayTeam) {
        const key = `${game.awayTeam.espnId}_${game.league}`;
        if (!teamsMap.has(key)) {
          teamsMap.set(key, {
            espnId: game.awayTeam.espnId,
            name: game.awayTeam.name,
            abbreviation: game.awayTeam.abbreviation,
            location: game.awayTeam.location || null,
            logo: game.awayTeam.logo,
            sport: game.sport,
            league: game.league
          });
        }
      }
    }

    const teamsArray = Array.from(teamsMap.values());
    const results = await this.bulkUpsert(teamsArray, 'espn_id');

    // Clear cache for affected leagues
    for (const game of scoreboardData.games || []) {
      await this._clearLeagueCache(game.sport);
    }

    return results;
  }

  /**
   * Get or create team by ESPN ID with caching
   */
  async getOrCreate(espnTeamData, league) {
    // Check cache first
    const cacheKey = generateCacheKey('team', espnTeamData.espnId);
    const cached = await cacheClient.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Try to find existing team
    let team = await this.findByEspnId(espnTeamData.espnId);

    // Create if not exists
    if (!team) {
      team = await this.upsertFromESPN(espnTeamData, league);
    }

    // Cache for 7 days (teams rarely change)
    if (team) {
      await cacheClient.set(cacheKey, team, 604800);
    }

    return team;
  }

  /**
   * Get team ID by ESPN ID (for foreign key references)
   */
  async getIdByEspnId(espnId) {
    const team = await this.findByEspnId(espnId);
    return team ? team.id : null;
  }

  /**
   * Search teams by name
   */
  async searchByName(query, league = null) {
    try {
      let dbQuery = supabase
        .from(this.tableName)
        .select('*')
        .ilike('name', `%${query}%`);

      if (league) {
        dbQuery = dbQuery.eq('league', league);
      }

      dbQuery = dbQuery.limit(20);

      const { data, error } = await dbQuery;

      if (error) {
        logger.error('Teams searchByName error:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('Teams searchByName exception:', error);
      return [];
    }
  }

  /**
   * Get league name from sport code
   */
  _getLeagueName(sport) {
    const leagueNames = {
      nfl: 'NFL',
      nba: 'NBA',
      mlb: 'MLB',
      nhl: 'NHL',
      ncaaf: 'NCAAF',
      ncaab: 'NCAAB'
    };
    return leagueNames[sport] || sport.toUpperCase();
  }

  /**
   * Clear cache for a league
   */
  async _clearLeagueCache(sport) {
    await cacheClient.delPattern(`teams:${sport}:*`);
    await cacheClient.delPattern(`team:*`);
  }
}

// Export singleton instance
export const teamsRepository = new TeamsRepository();

export default TeamsRepository;
