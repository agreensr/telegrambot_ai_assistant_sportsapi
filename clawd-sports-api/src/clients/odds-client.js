/**
 * The Odds API Client
 * Fetches betting odds data from The Odds API v4.
 *
 * @see https://the-odds-api.com/
 */

import axios from 'axios';
import { logger } from '../utils/logger.js';

// The Odds API endpoints
const ODDS_API_BASE_URL = 'https://api.the-odds-api.com/v4';

// League mappings for The Odds API
const LEAGUE_CONFIG = {
  nfl: { key: 'americanfootball_nfl', name: 'NFL' },
  nba: { key: 'basketball_nba', name: 'NBA' },
  mlb: { key: 'baseball_mlb', name: 'MLB' },
  nhl: { key: 'icehockey_nhl', name: 'NHL' },
  ncaaf: { key: 'americanfootball_ncaaf', name: 'NCAAF' },
  ncaab: { key: 'basketball_ncaab', name: 'NCAAB' }
};

// Circuit breaker state
const circuitBreaker = {
  isOpen: false,
  failureCount: 0,
  lastFailureTime: null,
  threshold: 3, // Open after 3 consecutive failures (stricter due to rate limits)
  resetTimeout: 60000 // Try again after 60 seconds
};

/**
 * Odds Client Class
 */
class OddsClient {
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.THE_ODDS_API_KEY;
    this.timeout = options.timeout || 10000; // 10 second default
    this.maxRetries = options.maxRetries || 2;
    this.retryDelay = options.retryDelay || 1000;

    if (!this.apiKey) {
      throw new Error('THE_ODDS_API_KEY is required');
    }

    // Create axios instance with defaults
    this.client = axios.create({
      baseURL: ODDS_API_BASE_URL,
      timeout: this.timeout,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ClawdBot/1.0'
      },
      params: {
        apiKey: this.apiKey
      }
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug(`Odds API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('Odds API Request Error:', error);
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
        logger.info('Odds API circuit breaker reset');
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
        logger.warn('Odds API circuit breaker opened due to failures');
      }

      logger.error(`Odds API Error ${error.response.status}:`, {
        url: error.config?.url,
        status: error.response.status,
        statusText: error.response.statusText
      });
    } else if (error.request) {
      // Request made but no response received
      logger.error('Odds API Network Error:', {
        url: error.config?.url,
        message: error.message
      });
    } else {
      logger.error('Odds API Error:', error.message);
    }

    return Promise.reject(error);
  }

  /**
   * Execute request with retry logic
   */
  async _fetchWithRetry(config, retries = this.maxRetries) {
    if (this._isCircuitOpen()) {
      throw new Error('Odds API circuit breaker is open');
    }

    try {
      const response = await this.client.request(config);
      return response.data;
    } catch (error) {
      if (retries > 0 && this._shouldRetry(error)) {
        logger.debug(`Retrying Odds API request, ${retries} attempts remaining`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this._fetchWithRetry(config, retries - 1);
      }
      throw error;
    }
  }

  /**
   * Determine if error is retryable
   */
  _shouldRetry(error) {
    const retryableStatuses = [408, 429, 500, 502, 503, 504];
    return (
      error.code === 'ECONNABORTED' ||
      error.code === 'ETIMEDOUT' ||
      (error.response && retryableStatuses.includes(error.response.status))
    );
  }

  /**
   * Get league key for The Odds API
   * @param {string} league - League identifier
   * @returns {string} The Odds API league key
   */
  _getLeagueKey(league) {
    const config = LEAGUE_CONFIG[league];
    if (!config) {
      throw new Error(`Invalid league: ${league}. Must be one of: ${Object.keys(LEAGUE_CONFIG).join(', ')}`);
    }
    return config.key;
  }

  /**
   * Get odds for a specific league
   * @param {string} league - League identifier (nfl, nba, mlb, nhl, ncaaf, ncaab)
   * @param {Object} options - Additional options
   * @param {string} options.regions - Regions for odds (us, uk, eu, au)
   * @param {string} options.markets - Markets to include (h2h, spreads, totals)
   * @param {string} options.oddsFormat - Odds format (american, decimal, fractional)
   * @param {Date} options.commenceTimeFrom - Filter games from this date
   * @param {Date} options.commenceTimeTo - Filter games until this date
   * @returns {Promise<Object>} Normalized odds data
   */
  async getOdds(league, options = {}) {
    const leagueKey = this._getLeagueKey(league);

    const params = {
      regions: options.regions || 'us',
      markets: options.markets || 'h2h,spreads,totals',
      oddsFormat: options.oddsFormat || 'american'
    };

    if (options.commenceTimeFrom) {
      params.commenceTimeFrom = options.commenceTimeFrom.toISOString();
    }
    if (options.commenceTimeTo) {
      params.commenceTimeTo = options.commenceTimeTo.toISOString();
    }

    const data = await this._fetchWithRetry({
      method: 'GET',
      url: `/sports/${leagueKey}/odds`,
      params
    });

    return this._normalizeOddsData(data, league);
  }

  /**
   * Normalize odds data from The Odds API
   * @param {Array} data - Raw odds data from API
   * @param {string} league - League identifier
   * @returns {Object} Normalized odds data
   */
  _normalizeOddsData(data, league) {
    const games = Array.isArray(data) ? data.map(game => this._normalizeGame(game, league)) : [];

    return {
      sport: league,
      league: LEAGUE_CONFIG[league]?.name || league.toUpperCase(),
      lastUpdated: new Date().toISOString(),
      games
    };
  }

  /**
   * Normalize individual game data
   * @param {Object} game - Raw game data from API
   * @param {string} league - League identifier
   * @returns {Object} Normalized game data
   */
  _normalizeGame(game, league) {
    return {
      espnId: game.id,
      sport: league,
      league: LEAGUE_CONFIG[league]?.name || league.toUpperCase(),
      homeTeam: game.home_team,
      awayTeam: game.away_team,
      commenceTime: game.commence_time,
      bookmakers: Array.isArray(game.bookmakers)
        ? game.bookmakers.map(bm => this._normalizeBookmaker(bm))
        : []
    };
  }

  /**
   * Normalize bookmaker data
   * @param {Object} bookmaker - Raw bookmaker data from API
   * @returns {Object} Normalized bookmaker data
   */
  _normalizeBookmaker(bookmaker) {
    return {
      key: bookmaker.key,
      title: bookmaker.title,
      lastUpdate: bookmaker.last_update,
      markets: Array.isArray(bookmaker.markets)
        ? bookmaker.markets.map(market => this._normalizeMarket(market))
        : []
    };
  }

  /**
   * Normalize market data
   * @param {Object} market - Raw market data from API
   * @returns {Object} Normalized market data
   */
  _normalizeMarket(market) {
    return {
      key: market.key,
      lastUpdate: market.last_update,
      outcomes: Array.isArray(market.outcomes)
        ? market.outcomes.map(outcome => ({
            name: outcome.name,
            price: outcome.price,
            point: outcome.point || null
          }))
        : []
    };
  }

  /**
   * Health check for Odds API
   * @returns {Promise<Object>} Health status
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
        url: '/sports/basketball_nba/scores',
        params: { days: 1 }
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

// Export class for testing
export default OddsClient;

// Lazy singleton getter
let _singleton = null;
export const getOddsClient = () => {
  if (!_singleton) {
    _singleton = new OddsClient();
  }
  return _singleton;
};
