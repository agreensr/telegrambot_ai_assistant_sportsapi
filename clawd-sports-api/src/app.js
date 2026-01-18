/**
 * Express Application Setup
 * Configures Express app with middleware and routes
 * Integrates data persistence layer (Supabase) and caching (Redis)
 */

import express from 'express';
import { espnClient } from './clients/espn-client.js';
import { getOddsClient } from './clients/odds-client.js';
import { logger } from './utils/logger.js';
import { healthCheck as dbHealthCheck } from './config/database.js';
import { cacheClient, healthCheck as cacheHealthCheck } from './config/cache.js';
import { gamesRepository } from './repositories/GamesRepository.js';
import { oddsRepository } from './repositories/OddsRepository.js';
import { newsRepository } from './repositories/NewsRepository.js';
import { teamsRepository } from './repositories/TeamsRepository.js';
import { cacheScores, cacheOdds, cacheNews, cacheControl } from './middleware/cacheMiddleware.js';

// Create Express app
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  logger.http(`${req.method} ${req.url}`);
  next();
});

// Make clients and repositories available to routes
app.locals.espnClient = espnClient;
app.locals.oddsClient = getOddsClient();
app.locals.gamesRepository = gamesRepository;
app.locals.oddsRepository = oddsRepository;
app.locals.newsRepository = newsRepository;
app.locals.teamsRepository = teamsRepository;

// ===================
// Routes
// ===================

/**
 * Health check endpoint
 * GET /health
 */
app.get('/health', async (req, res, next) => {
  try {
    const espnHealth = await app.locals.espnClient.healthCheck();
    const oddsHealth = await app.locals.oddsClient.healthCheck();
    const dbHealth = await dbHealthCheck();
    const cacheHealth = await cacheHealthCheck();

    const checks = {
      espn_api: {
        status: espnHealth.status,
        latency: espnHealth.latency,
        circuitBreakerOpen: espnHealth.circuitBreakerOpen
      },
      odds_api: {
        status: oddsHealth.status,
        latency: oddsHealth.latency,
        circuitBreakerOpen: oddsHealth.circuitBreakerOpen
      },
      database: {
        status: dbHealth.status,
        latency: dbHealth.latency,
        connected: dbHealth.connected
      },
      cache: {
        status: cacheHealth.status,
        latency: cacheHealth.latency,
        connected: cacheHealth.connected
      }
    };

    const allHealthy = Object.values(checks).every(check =>
      check.status === 'healthy' || check.connected === true
    );
    const overallStatus = allHealthy ? 'healthy' : 'degraded';

    res.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks
    });
  } catch (error) {
    logger.error('Health check error:', error);
    next(error);
  }
});

/**
 * Validate league parameter
 */
function validateLeague(league) {
  const validLeagues = ['nfl', 'nba', 'mlb', 'nhl', 'ncaaf', 'ncaab'];
  if (!validLeagues.includes(league)) {
    return false;
  }
  return true;
}

/**
 * Error handler middleware
 */
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);

  // Handle circuit breaker errors
  if (err.message && err.message.includes('circuit breaker is open')) {
    return res.status(503).json({
      error: 'Service temporarily unavailable',
      message: err.message
    });
  }

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'An error occurred' : err.message
  });
});

// ===================
// API Routes
// ===================

/**
 * Get scores for a league
 * GET /api/scores/:league
 *
 * Uses caching layer (30s TTL) and syncs to database
 */
app.get('/api/scores/:league', cacheScores(), cacheControl(30), async (req, res, next) => {
  try {
    const { league } = req.params;

    if (!validateLeague(league)) {
      return res.status(400).json({
        error: 'Invalid league',
        validLeagues: ['nfl', 'nba', 'mlb', 'nhl', 'ncaaf', 'ncaab']
      });
    }

    // Fetch from ESPN API
    const data = await app.locals.espnClient.getScoreboard(league);

    // Sync games and teams to database (non-blocking)
    app.locals.gamesRepository.syncFromScoreboard(data).catch(err => {
      logger.warn('Failed to sync games to database:', err);
    });

    // Sync teams to database (non-blocking)
    app.locals.teamsRepository.syncFromScoreboard(data).catch(err => {
      logger.warn('Failed to sync teams to database:', err);
    });

    res.json(data);
  } catch (error) {
    next(error);
  }
});

/**
 * Get betting odds for a league
 * GET /api/odds/:league
 *
 * Uses caching layer (5min TTL) and syncs to database
 */
app.get('/api/odds/:league', cacheOdds(), cacheControl(300), async (req, res, next) => {
  try {
    const { league } = req.params;
    const regions = req.query.regions;
    const markets = req.query.markets;

    if (!validateLeague(league)) {
      return res.status(400).json({
        error: 'Invalid league',
        validLeagues: ['nfl', 'nba', 'mlb', 'nhl', 'ncaaf', 'ncaab']
      });
    }

    const options = {};
    if (regions) options.regions = regions;
    if (markets) options.markets = markets;

    // Fetch from The Odds API
    const data = await app.locals.oddsClient.getOdds(league, options);

    // Sync odds to database (non-blocking)
    app.locals.oddsRepository.syncFromOddsAPI(data, league).catch(err => {
      logger.warn('Failed to sync odds to database:', err);
    });

    res.json(data);
  } catch (error) {
    next(error);
  }
});

/**
 * Get standings for a league
 * GET /api/standings/:league
 */
app.get('/api/standings/:league', async (req, res, next) => {
  try {
    const { league } = req.params;

    if (!validateLeague(league)) {
      return res.status(400).json({
        error: 'Invalid league',
        validLeagues: ['nfl', 'nba', 'mlb', 'nhl', 'ncaaf', 'ncaab']
      });
    }

    const data = await app.locals.espnClient.getStandings(league);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

/**
 * Get news for a league
 * GET /api/news/:league
 *
 * Uses caching layer (1hr TTL) and syncs to database
 */
app.get('/api/news/:league', cacheNews(), cacheControl(3600), async (req, res, next) => {
  try {
    const { league } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit) : 25;

    if (!validateLeague(league)) {
      return res.status(400).json({
        error: 'Invalid league',
        validLeagues: ['nfl', 'nba', 'mlb', 'nhl', 'ncaaf', 'ncaab']
      });
    }

    // Fetch from ESPN API
    const data = await app.locals.espnClient.getNews(league, limit);

    // Sync news to database (non-blocking)
    app.locals.newsRepository.syncFromESPN(data, league).catch(err => {
      logger.warn('Failed to sync news to database:', err);
    });

    res.json(data);
  } catch (error) {
    next(error);
  }
});

/**
 * Get teams for a league
 * GET /api/teams/:league
 */
app.get('/api/teams/:league', cacheControl(3600), async (req, res, next) => {
  try {
    const { league } = req.params;

    if (!validateLeague(league)) {
      return res.status(400).json({
        error: 'Invalid league',
        validLeagues: ['nfl', 'nba', 'mlb', 'nhl', 'ncaaf', 'ncaab']
      });
    }

    // First try to get from cache
    const cacheKey = `teams:${league}`;
    const cached = await cacheClient.get(cacheKey);
    if (cached) {
      logger.debug(`Returning cached teams for ${league}`);
      return res.json(cached);
    }

    // Fetch teams from ESPN client (using getScoreboard which includes team data)
    const scoreboard = await app.locals.espnClient.getScoreboard(league);
    const teams = [];

    // Extract unique teams from games
    const teamIds = new Set();
    for (const game of scoreboard.games || []) {
      [game.homeTeam, game.awayTeam].forEach(team => {
        const id = team.espnId || team.id;
        if (!teamIds.has(id)) {
          teamIds.add(id);
          teams.push({
            espnId: team.espnId || team.id,
            name: team.name,
            abbreviation: team.abbreviation,
            logo: team.logo,
            location: team.location,
            records: team.records
          });
        }
      });
    }

    // Cache for 1 hour
    await cacheClient.set(cacheKey, teams, 3600);

    res.json({
      sport: league,
      league: scoreboard.league,
      teams
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get team details
 * GET /api/team/:league/:teamId
 */
app.get('/api/team/:league/:teamId', async (req, res, next) => {
  try {
    const { league, teamId } = req.params;

    if (!validateLeague(league)) {
      return res.status(400).json({
        error: 'Invalid league',
        validLeagues: ['nfl', 'nba', 'mlb', 'nhl', 'ncaaf', 'ncaab']
      });
    }

    // Check if team exists in database
    const team = await app.locals.teamsRepository.findByEspnId(teamId);
    if (team) {
      return res.json(team);
    }

    // Otherwise fetch from ESPN API
    const data = await app.locals.espnClient.getTeam(league, teamId);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

/**
 * Get player details
 * GET /api/player/:league/:playerId
 */
app.get('/api/player/:league/:playerId', async (req, res, next) => {
  try {
    const { league, playerId } = req.params;

    if (!validateLeague(league)) {
      return res.status(400).json({
        error: 'Invalid league',
        validLeagues: ['nfl', 'nba', 'mlb', 'nhl', 'ncaaf', 'ncaab']
      });
    }

    // Fetch from ESPN API
    const data = await app.locals.espnClient.getPlayer(league, playerId);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

/**
 * Get odds for a specific game
 * GET /api/odds/game/:gameId
 */
app.get('/api/odds/game/:gameId', cacheControl(300), async (req, res, next) => {
  try {
    const { gameId } = req.params;
    const regions = req.query.regions;
    const markets = req.query.markets;

    // Get game from database to find league
    const game = await app.locals.gamesRepository.findByEspnId(gameId);
    if (!game) {
      return res.status(404).json({
        error: 'Game not found',
        gameId
      });
    }

    // Get odds from Odds API
    const data = await app.locals.oddsClient.getOdds(game.sport, {
      regions,
      markets: markets || ['h2h', 'spreads', 'totals']
    });

    // Filter to specific game
    const gameOdds = data.games?.find(g => g.id === gameId);
    if (!gameOdds) {
      return res.status(404).json({
        error: 'Odds not found for this game',
        gameId
      });
    }

    res.json(gameOdds);
  } catch (error) {
    next(error);
  }
});

/**
 * Get best odds across all sportsbooks for a league
 * GET /api/odds/best/:league
 */
app.get('/api/odds/best/:league', cacheControl(300), async (req, res, next) => {
  try {
    const { league } = req.params;
    const sportsbook = req.query.sportsbook;
    const market = req.query.market || 'h2h';

    if (!validateLeague(league)) {
      return res.status(400).json({
        error: 'Invalid league',
        validLeagues: ['nfl', 'nba', 'mlb', 'nhl', 'ncaaf', 'ncaab']
      });
    }

    // Get all odds from Odds API
    const data = await app.locals.oddsClient.getOdds(league, {
      markets: ['h2h', 'spreads', 'totals']
    });

    // Aggregate best odds by game and sportsbook
    const bestOdds = {};
    for (const game of data.games || []) {
      bestOdds[game.id] = {};

      for (const bookmaker of game.bookmakers || []) {
        const h2hMarket = bookmaker.markets?.find(m => m.key === 'h2h');
        if (h2hMarket && h2hMarket.outcomes && h2hMarket.outcomes.length === 2) {
          const homeOutcome = h2hMarket.outcomes[0];
          const awayOutcome = h2hMarket.outcomes[1];

          if (!bestOdds[game.id].home || homeOutcome.price > (bestOdds[game.id].home?.odds || 0)) {
            bestOdds[game.id].home = {
              odds: homeOutcome.price,
              sportsbook: bookmaker.title
            };
          }
          if (!bestOdds[game.id].away || awayOutcome.price > (bestOdds[game.id].away?.odds || 0)) {
            bestOdds[game.id].away = {
              odds: awayOutcome.price,
              sportsbook: bookmaker.title
            };
          }
        }
      }
    }

    res.json({
      league,
      lastUpdated: new Date().toISOString(),
      bestOdds: Object.values(bestOdds)
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get available sportsbooks
 * GET /api/sportsbooks
 */
app.get('/api/sportsbooks', async (req, res, next) => {
  try {
    // Get odds from any league to see available sportsbooks
    const data = await app.locals.oddsClient.getOdds('nba');
    const sportsbooks = new Set();

    for (const game of data.games || []) {
      for (const bookmaker of game.bookmakers || []) {
        sportsbooks.add(bookmaker.title);
      }
    }

    res.json({
      sportsbooks: Array.from(sportsbooks).sort(),
      league: 'nba'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get cache statistics
 * GET /api/cache/stats
 */
app.get('/api/cache/stats', async (req, res, next) => {
  try {
    const stats = await cacheClient.getStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

/**
 * Clear cache by pattern
 * DELETE /api/cache/clear/:pattern
 */
app.delete('/api/cache/clear/:pattern', async (req, res, next) => {
  try {
    const { pattern } = req.params;
    const count = await cacheClient.delPattern(pattern);

    res.json({
      cleared: true,
      pattern,
      count
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 404 handler
 */
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.url
  });
});

// Export app for testing and server.js
export default app;
