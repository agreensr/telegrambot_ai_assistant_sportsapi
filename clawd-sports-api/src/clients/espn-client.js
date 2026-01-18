/**
 * ESPN API Client
 * Fetches sports data from ESPN's public API endpoints.
 * ESPN API is public and requires no authentication.
 *
 * @see https://www.espn.com/apis/
 */

import axios from 'axios';
import { logger } from '../utils/logger.js';
import StandingsScraper from './standings-scraper.js';

// ESPN API endpoints
const ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports';

// League mappings
const LEAGUE_CONFIG = {
  nfl: { path: 'football/nfl', name: 'NFL' },
  nba: { path: 'basketball/nba', name: 'NBA' },
  mlb: { path: 'baseball/mlb', name: 'MLB' },
  nhl: { path: 'hockey/nhl', name: 'NHL' },
  ncaaf: { path: 'football/college-football', name: 'NCAAF' },
  ncaab: { path: 'basketball/mens-college-basketball', name: 'NCAAB' }
};

// Circuit breaker state
const circuitBreaker = {
  isOpen: false,
  failureCount: 0,
  lastFailureTime: null,
  threshold: 5, // Open after 5 consecutive failures
  resetTimeout: 30000 // Try again after 30 seconds
};

/**
 * ESPN Client Class
 */
class ESPNClient {
  constructor(options = {}) {
    this.timeout = options.timeout || 10000; // 10 second default
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;

    // Initialize standings scraper
    this.standingsScraper = new StandingsScraper();

    // Create axios instance with defaults
    this.client = axios.create({
      baseURL: ESPN_BASE_URL,
      timeout: this.timeout,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ClawdBot/1.0'
      }
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug(`ESPN API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('ESPN API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        return this._handleError(error);
      }
    );
  }

  /**
   * Check if circuit breaker is open
   */
  _isCircuitOpen() {
    if (circuitBreaker.isOpen) {
      const timeSinceLastFailure = Date.now() - circuitBreaker.lastFailureTime;
      if (timeSinceLastFailure > circuitBreaker.resetTimeout) {
        // Attempt to reset circuit breaker
        circuitBreaker.isOpen = false;
        circuitBreaker.failureCount = 0;
        logger.info('ESPN API circuit breaker reset');
        return false;
      }
      return true;
    }
    return false;
  }

  /**
   * Handle API errors with circuit breaker logic
   */
  _handleError(error) {
    if (error.response) {
      // Server responded with error status
      circuitBreaker.failureCount++;
      circuitBreaker.lastFailureTime = Date.now();

      if (circuitBreaker.failureCount >= circuitBreaker.threshold) {
        circuitBreaker.isOpen = true;
        logger.warn('ESPN API circuit breaker opened due to failures');
      }

      logger.error(`ESPN API Error ${error.response.status}:`, {
        url: error.config?.url,
        status: error.response.status,
        statusText: error.response.statusText
      });
    } else if (error.request) {
      // Request made but no response received
      logger.error('ESPN API Network Error:', {
        url: error.config?.url,
        message: error.message
      });
    } else {
      logger.error('ESPN API Error:', error.message);
    }

    return Promise.reject(error);
  }

  /**
   * Execute request with retry logic
   */
  async _fetchWithRetry(config, retries = this.maxRetries) {
    if (this._isCircuitOpen()) {
      throw new Error('ESPN API circuit breaker is open');
    }

    try {
      const response = await this.client.request(config);
      // Reset failure count on success
      circuitBreaker.failureCount = 0;
      return response.data;
    } catch (error) {
      if (retries > 0 && this._isRetryable(error)) {
        logger.debug(`Retrying ESPN API request (${retries} attempts left)`);
        await this._delay(this.retryDelay);
        return this._fetchWithRetry(config, retries - 1);
      }
      throw error;
    }
  }

  /**
   * Check if error is retryable
   */
  _isRetryable(error) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return true;
    }
    if (error.response?.status >= 500) {
      return true;
    }
    if (error.response?.status === 429) {
      return true; // Rate limit
    }
    return false;
  }

  /**
   * Delay helper
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get league path from league identifier
   */
  _getLeaguePath(league) {
    const config = LEAGUE_CONFIG[league.toLowerCase()];
    if (!config) {
      throw new Error(`Invalid league: ${league}. Supported: ${Object.keys(LEAGUE_CONFIG).join(', ')}`);
    }
    return config.path;
  }

  // ============================================================
  // PUBLIC API METHODS
  // ============================================================

  /**
   * Get scoreboard (current games) for a league
   * @param {string} league - League identifier (nfl, nba, mlb, etc.)
   * @param {Object} options - Query options
   * @param {string} options.limit - Limit number of games
   * @param {string} options.dates - Specific date (YYYYMMDD)
   * @returns {Promise<Object>} Scoreboard data
   */
  async getScoreboard(league, options = {}) {
    const leaguePath = this._getLeaguePath(league);
    const params = [];

    if (options.limit) params.push(`limit=${options.limit}`);
    if (options.dates) params.push(`dates=${options.dates}`);

    const queryString = params.length > 0 ? `?${params.join('&')}` : '';

    const data = await this._fetchWithRetry({
      method: 'GET',
      url: `/${leaguePath}/scoreboard${queryString}`
    });

    return this._normalizeScoreboard(data, league);
  }

  /**
   * Get standings for a league
   * @param {string} league - League identifier
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Standings data
   */
  async getStandings(league, options = {}) {
    // Use web scraper for standings (ESPN API returns minimal data)
    return await this.standingsScraper.scrapeStandings(league);
  }

  /**
   * Get team information
   * @param {string} league - League identifier
   * @param {string} teamId - ESPN team ID
   * @returns {Promise<Object>} Team data
   */
  async getTeam(league, teamId) {
    const leaguePath = this._getLeaguePath(league);

    const data = await this._fetchWithRetry({
      method: 'GET',
      url: `/${leaguePath}/teams/${teamId}`
    });

    return this._normalizeTeam(data, league);
  }

  /**
   * Get player information
   * @param {string} league - League identifier
   * @param {string} playerId - ESPN player ID
   * @returns {Promise<Object>} Player data
   */
  async getPlayer(league, playerId) {
    const leaguePath = this._getLeaguePath(league);

    const data = await this._fetchWithRetry({
      method: 'GET',
      url: `/${leaguePath}/athletes/${playerId}`
    });

    return this._normalizePlayer(data, league);
  }

  /**
   * Get game details
   * @param {string} league - League identifier
   * @param {string} gameId - ESPN game ID
   * @returns {Promise<Object>} Game data
   */
  async getGame(league, gameId) {
    const leaguePath = this._getLeaguePath(league);

    const data = await this._fetchWithRetry({
      method: 'GET',
      url: `/${leaguePath}/scoreboard/gameId/${gameId}`
    });

    return this._normalizeGame(data, league);
  }

  /**
   * Get news for a league
   * @param {string} league - League identifier
   * @param {number} limit - Number of articles (default: 25)
   * @returns {Promise<Array>} News articles
   */
  async getNews(league, limit = 25) {
    const leaguePath = this._getLeaguePath(league);

    const data = await this._fetchWithRetry({
      method: 'GET',
      url: `/${leaguePath}/news?limit=${limit}`
    });

    return this._normalizeNews(data, league);
  }

  // ============================================================
  // DATA NORMALIZATION METHODS
  // ============================================================

  /**
   * Normalize scoreboard data to standard format
   */
  _normalizeScoreboard(data, league) {
    const events = data?.events || [];

    return {
      sport: league,
      league: LEAGUE_CONFIG[league]?.name || league.toUpperCase(),
      lastUpdated: new Date().toISOString(),
      games: events.map(event => this._normalizeGameData(event, league))
    };
  }

  /**
   * Normalize individual game data
   */
  _normalizeGameData(event, league) {
    const home = event.competitions?.[0]?.competitors?.find(c => c.homeAway === 'home');
    const away = event.competitions?.[0]?.competitors?.find(c => c.homeAway === 'away');

    return {
      espnId: String(event.id),
      sport: league,
      league: LEAGUE_CONFIG[league]?.name || league.toUpperCase(),
      homeTeam: {
        id: home?.team?.id,
        espnId: String(home?.team?.id),
        name: home?.team?.displayName,
        abbreviation: home?.team?.abbreviation,
        logo: home?.team?.logo,
        score: parseInt(home?.score) || null,
        records: home?.records?.[0]?.summary || null
      },
      awayTeam: {
        id: away?.team?.id,
        espnId: String(away?.team?.id),
        name: away?.team?.displayName,
        abbreviation: away?.team?.abbreviation,
        logo: away?.team?.logo,
        score: parseInt(away?.score) || null,
        records: away?.records?.[0]?.summary || null
      },
      status: {
        type: {
          id: event.status?.type?.id,
          name: event.status?.type?.name,
          state: event.status?.type?.state,
          detail: event.status?.type?.detail
        },
        period: event.status?.period,
        clock: event.status?.type?.shortDetail,
        completed: event.status?.type?.state === 'post'
      },
      startTime: event.date,
      venue: event.competitions?.[0]?.venue?.fullName,
      broadcast: event.competitions?.[0]?.broadcasts?.[0]?.names?.[0] || null
    };
  }

  /**
   * Normalize standings data
   */
  _normalizeStandings(data, league) {
    // TODO: Implement standings normalization
    // ESPN standings structure varies by league
    return {
      sport: league,
      league: LEAGUE_CONFIG[league]?.name || league.toUpperCase(),
      lastUpdated: new Date().toISOString(),
      standings: []
    };
  }

  /**
   * Normalize team data
   */
  _normalizeTeam(data, league) {
    const team = data?.team || data;

    return {
      espnId: String(team.id),
      sport: league,
      league: LEAGUE_CONFIG[league]?.name || league.toUpperCase(),
      name: team.displayName,
      abbreviation: team.abbreviation,
      location: team.location,
      logo: team.logos?.[0]?.href || team.logo,
      color: team.color,
      alternateColor: team.alternateColor,
      links: team.links
    };
  }

  /**
   * Normalize player data
   */
  _normalizePlayer(data, league) {
    const athlete = data?.athlete || data;

    return {
      espnId: String(athlete.id),
      name: athlete.displayName,
      firstName: athlete.firstName,
      lastName: athlete.lastName,
      position: athlete.position?.displayName || null,
      jerseyNumber: athlete.jersey || null,
      height: athlete.displayHeight || null,
      weight: athlete.displayWeight || null,
      age: athlete.age || null,
      headshot: athlete.headshot?.href || null,
      team: {
        id: athlete.team?.id,
        espnId: String(athlete.team?.id),
        name: athlete.team?.displayName,
        abbreviation: athlete.team?.abbreviation
      },
      stats: athlete.stats?.[0]?.splits || [],
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Normalize game details
   */
  _normalizeGame(data, league) {
    // Game detail data structure is similar to scoreboard events
    return this._normalizeGameData(data, league);
  }

  /**
   * Normalize news data
   */
  _normalizeNews(data, league) {
    const articles = data?.articles || data || [];

    return articles.map(article => ({
      espnId: article.id,
      sport: league,
      league: LEAGUE_CONFIG[league]?.name || league.toUpperCase(),
      headline: article.headline,
      description: article.description,
      storyUrl: article.links?.web?.href || article.link,
      imageUrl: article.images?.[0]?.url || null,
      publishedAt: article.published,
      author: article.byline,
      lastUpdated: new Date().toISOString()
    }));
  }

  /**
   * Health check for ESPN API
   */
  async healthCheck() {
    if (this._isCircuitOpen()) {
      return {
        status: 'unhealthy',
        message: 'Circuit breaker is open',
        lastFailureTime: circuitBreaker.lastFailureTime
      };
    }

    try {
      const startTime = Date.now();
      await this._fetchWithRetry({
        method: 'GET',
        url: '/football/nfl/scoreboard?limit=1'
      });
      const duration = Date.now() - startTime;

      return {
        status: 'healthy',
        latency: duration,
        circuitBreakerOpen: false
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error.message,
        circuitBreakerOpen: circuitBreaker.isOpen
      };
    }
  }
}

// Export singleton instance
export const espnClient = new ESPNClient();

// Export class for testing
export default ESPNClient;
