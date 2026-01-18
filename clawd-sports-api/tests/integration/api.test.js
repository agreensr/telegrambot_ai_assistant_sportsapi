/**
 * API Integration Tests
 * Tests for Express API endpoints with mocked clients
 */

import { describe, it, mock, before, after } from 'node:test';
import assert from 'node:assert';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set API key before importing
process.env.THE_ODDS_API_KEY = 'test-api-key';

// Mock clients before importing server
const mockEspnData = {
  sport: 'nba',
  league: 'NBA',
  games: [
    {
      espnId: '401673744',
      homeTeam: {
        id: '34',
        espnId: '34',
        name: 'Boston Celtics',
        abbreviation: 'BOS',
        score: 110,
        records: '12-3'
      },
      awayTeam: {
        id: '25',
        espnId: '25',
        name: 'Los Angeles Lakers',
        abbreviation: 'LAL',
        score: 105,
        records: '10-5'
      },
      status: {
        type: { id: '3', state: 'in', detail: 'Q4' },
        period: 4,
        clock: '2:45'
      },
      startTime: new Date().toISOString(),
      venue: 'TD Garden'
    }
  ],
  lastUpdated: new Date().toISOString()
};

const mockOddsData = {
  sport: 'nba',
  league: 'NBA',
  games: [
    {
      id: '401673744',
      espnId: '401673744',
      homeTeam: 'Boston Celtics',
      awayTeam: 'Los Angeles Lakers',
      commenceTime: new Date(Date.now() + 3600000).toISOString(),
      bookmakers: [
        {
          key: 'draftkings',
          title: 'DraftKings',
          lastUpdate: new Date().toISOString(),
          markets: [
            {
              key: 'h2h',
              outcomes: [
                { name: 'Boston Celtics', price: -150 },
                { name: 'Los Angeles Lakers', price: 130 }
              ]
            },
            {
              key: 'spreads',
              outcomes: [
                { name: 'Boston Celtics', price: -110, point: -3.5 },
                { name: 'Los Angeles Lakers', price: -110, point: 3.5 }
              ]
            }
          ]
        }
      ]
    }
  ],
  lastUpdated: new Date().toISOString()
};

// Mock ESPN client
const mockEspnClient = {
  getScoreboard: async (league) => mockEspnData,
  getStandings: async (league) => ({ sport: league, league: 'NBA', standings: [] }),
  getTeam: async (league, teamId) => ({ espnId: teamId, name: 'Test Team' }),
  getPlayer: async (league, playerId) => ({ espnId: playerId, name: 'Test Player' }),
  getNews: async (league, limit = 25) => ({
    sport: league,
    league: 'NBA',
    articles: []
  }),
  healthCheck: async () => ({ status: 'healthy', latency: 50, circuitBreakerOpen: false })
};

// Mock Odds client
const mockOddsClient = {
  getOdds: async (league, options = {}) => mockOddsData,
  healthCheck: async () => ({ status: 'healthy', latency: 50, circuitBreakerOpen: false })
};

// Import after mocks are set
let server;
let app;

describe('API Integration Tests', () => {
  let baseUrl;
  let serverInstance;

  before(async () => {
    // Set up test environment variables
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';

    // Import app after environment is set up
    const appModule = await import('../../src/app.js');
    app = appModule.default;

    // Override the clients with mocks
    app.locals.espnClient = mockEspnClient;
    app.locals.oddsClient = mockOddsClient;

    // Mock repository sync methods (these are called in the routes)
    app.locals.gamesRepository.syncFromScoreboard = async () => ({ successful: 1, failed: 0, total: 1 });
    app.locals.teamsRepository.syncFromScoreboard = async () => ({ successful: 2, failed: 0, total: 2 });
    app.locals.oddsRepository.syncFromOddsAPI = async () => ({ successful: 1, failed: 0, total: 1 });
    app.locals.newsRepository.syncFromESPN = async () => ({ successful: 0, failed: 0, total: 0 });

    // Mock findByEspnId for games repository (used in /api/odds/game/:gameId route)
    app.locals.gamesRepository.findByEspnId = async (espnId) => {
      if (espnId === '401673744') {
        return {
          id: 1,
          espn_id: '401673744',
          sport: 'nba',
          home_team: 'Boston Celtics',
          away_team: 'Los Angeles Lakers'
        };
      }
      return null;
    };

    // Create server and listen on random port
    serverInstance = await new Promise((resolve) => {
      const server = createServer(app);
      server.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}`;
        resolve(server);
      });
    });
  });

  after(() => {
    if (serverInstance) {
      serverInstance.close();
    }
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await fetch(`${baseUrl}/health`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.ok(data.status);
      assert.ok(data.timestamp);
      assert.ok(data.checks);
    });

    it('should include ESPN API health', async () => {
      const response = await fetch(`${baseUrl}/health`);
      const data = await response.json();

      assert.ok(data.checks.espn_api);
      assert.strictEqual(data.checks.espn_api.status, 'healthy');
    });

    it('should include Odds API health', async () => {
      const response = await fetch(`${baseUrl}/health`);
      const data = await response.json();

      assert.ok(data.checks.odds_api);
      assert.strictEqual(data.checks.odds_api.status, 'healthy');
    });

    it('should include database health', async () => {
      const response = await fetch(`${baseUrl}/health`);
      const data = await response.json();

      assert.ok(data.checks.database);
      // In test mode, database may not be connected but should return a health object
      assert.ok(data.checks.database.status !== undefined);
    });

    it('should include cache health', async () => {
      const response = await fetch(`${baseUrl}/health`);
      const data = await response.json();

      assert.ok(data.checks.cache);
      // In test mode, cache may not be connected but should return a health object
      assert.ok(data.checks.cache.status !== undefined);
    });
  });

  describe('GET /api/scores/:league', () => {
    it('should return scores for valid league', async () => {
      const response = await fetch(`${baseUrl}/api/scores/nba`);

      assert.strictEqual(response.status, 200);

      const data = await response.json();
      assert.strictEqual(data.sport, 'nba');
      assert.strictEqual(data.league, 'NBA');
      assert.ok(Array.isArray(data.games));
      assert.ok(data.games.length > 0);
    });

    it('should include game details', async () => {
      const response = await fetch(`${baseUrl}/api/scores/nba`);
      const data = await response.json();
      const game = data.games[0];

      assert.ok(game.homeTeam);
      assert.ok(game.awayTeam);
      assert.ok(game.status);
    });

    it('should return 400 for invalid league', async () => {
      const response = await fetch(`${baseUrl}/api/scores/invalid`);

      assert.strictEqual(response.status, 400);

      const data = await response.json();
      assert.ok(data.error);
    });
  });

  describe('GET /api/odds/:league', () => {
    it('should return odds for valid league', async () => {
      const response = await fetch(`${baseUrl}/api/odds/nba`);

      assert.strictEqual(response.status, 200);

      const data = await response.json();
      assert.strictEqual(data.sport, 'nba');
      assert.strictEqual(data.league, 'NBA');
      assert.ok(Array.isArray(data.games));
    });

    it('should include bookmaker data', async () => {
      const response = await fetch(`${baseUrl}/api/odds/nba`);
      const data = await response.json();
      const game = data.games[0];

      assert.ok(game.bookmakers);
      assert.ok(Array.isArray(game.bookmakers));
      assert.ok(game.bookmakers.length > 0);
    });

    it('should return 400 for invalid league', async () => {
      const response = await fetch(`${baseUrl}/api/odds/invalid`);

      assert.strictEqual(response.status, 400);

      const data = await response.json();
      assert.ok(data.error);
    });
  });

  describe('GET /api/standings/:league', () => {
    it('should return standings for valid league', async () => {
      const response = await fetch(`${baseUrl}/api/standings/nba`);

      assert.strictEqual(response.status, 200);

      const data = await response.json();
      assert.strictEqual(data.sport, 'nba');
      assert.strictEqual(data.league, 'NBA');
    });

    it('should return 400 for invalid league', async () => {
      const response = await fetch(`${baseUrl}/api/standings/invalid`);

      assert.strictEqual(response.status, 400);

      const data = await response.json();
      assert.ok(data.error);
    });
  });

  describe('GET /api/news/:league', () => {
    it('should return news for valid league', async () => {
      const response = await fetch(`${baseUrl}/api/news/nba`);

      assert.strictEqual(response.status, 200);

      const data = await response.json();
      assert.strictEqual(data.sport, 'nba');
      assert.ok(Array.isArray(data.articles));
    });

    it('should return 400 for invalid league', async () => {
      const response = await fetch(`${baseUrl}/api/news/invalid`);

      assert.strictEqual(response.status, 400);

      const data = await response.json();
      assert.ok(data.error);
    });
  });

    describe('GET /api/teams/:league', () => {
    it('should return teams for valid league', async () => {
      const response = await fetch(`${baseUrl}/api/teams/nba`);

      assert.strictEqual(response.status, 200);

      const data = await response.json();
      assert.strictEqual(data.sport, 'nba');
      assert.strictEqual(data.league, 'NBA');
      assert.ok(Array.isArray(data.teams));
    });

    it('should extract unique teams from scoreboard', async () => {
      const response = await fetch(`${baseUrl}/api/teams/nba`);
      const data = await response.json();

      // Should have extracted teams from the mocked scoreboard data
      assert.ok(data.teams.length >= 2);
      const teamNames = data.teams.map(t => t.name);
      assert.ok(teamNames.includes('Boston Celtics'));
      assert.ok(teamNames.includes('Los Angeles Lakers'));
    });

    it('should return 400 for invalid league', async () => {
      const response = await fetch(`${baseUrl}/api/teams/invalid`);

      assert.strictEqual(response.status, 400);

      const data = await response.json();
      assert.ok(data.error);
    });
  });

  describe('GET /api/team/:league/:teamId', () => {
    it('should return team details from database when found', async () => {
      // Mock team found in database
      app.locals.teamsRepository.findByEspnId = async (espnId) => ({
        id: 1,
        espn_id: '34',
        name: 'Boston Celtics',
        abbreviation: 'BOS',
        league: 'NBA',
        sport: 'nba'
      });

      const response = await fetch(`${baseUrl}/api/team/nba/34`);

      assert.strictEqual(response.status, 200);

      const data = await response.json();
      assert.strictEqual(data.espn_id, '34');
      assert.strictEqual(data.name, 'Boston Celtics');
    });

    it('should fetch from ESPN API when team not in database', async () => {
      // Mock team not found in database
      app.locals.teamsRepository.findByEspnId = async () => null;

      const response = await fetch(`${baseUrl}/api/team/nba/99`);

      assert.strictEqual(response.status, 200);

      const data = await response.json();
      assert.ok(data.espnId || data.espn_id);
    });

    it('should return 400 for invalid league', async () => {
      const response = await fetch(`${baseUrl}/api/team/invalid/34`);

      assert.strictEqual(response.status, 400);

      const data = await response.json();
      assert.ok(data.error);
    });
  });

  describe('GET /api/player/:league/:playerId', () => {
    it('should return player details', async () => {
      const response = await fetch(`${baseUrl}/api/player/nba/12345`);

      assert.strictEqual(response.status, 200);

      const data = await response.json();
      assert.ok(data.espnId || data.name);
    });

    it('should return 400 for invalid league', async () => {
      const response = await fetch(`${baseUrl}/api/player/invalid/12345`);

      assert.strictEqual(response.status, 400);

      const data = await response.json();
      assert.ok(data.error);
    });
  });

  describe('GET /api/odds/game/:gameId', () => {
    it('should return odds for specific game when found', async () => {
      const response = await fetch(`${baseUrl}/api/odds/game/401673744`);

      assert.strictEqual(response.status, 200);

      const data = await response.json();
      assert.ok(data.bookmakers || data.homeTeam);
    });

    it('should return 404 when game not found', async () => {
      const response = await fetch(`${baseUrl}/api/odds/game/999999`);

      assert.strictEqual(response.status, 404);

      const data = await response.json();
      assert.ok(data.error);
      assert.strictEqual(data.gameId, '999999');
    });
  });

  describe('GET /api/odds/best/:league', () => {
    it('should return best odds aggregated across sportsbooks', async () => {
      const response = await fetch(`${baseUrl}/api/odds/best/nba`);

      assert.strictEqual(response.status, 200);

      const data = await response.json();
      assert.strictEqual(data.league, 'nba');
      assert.ok(data.lastUpdated);
      assert.ok(Array.isArray(data.bestOdds));
    });

    it('should include home and away best odds', async () => {
      const response = await fetch(`${baseUrl}/api/odds/best/nba`);
      const data = await response.json();

      if (data.bestOdds.length > 0) {
        const gameOdds = data.bestOdds[0];
        // Should have best odds for home and/or away
        assert.ok(gameOdds.home || gameOdds.away);
      }
    });

    it('should return 400 for invalid league', async () => {
      const response = await fetch(`${baseUrl}/api/odds/best/invalid`);

      assert.strictEqual(response.status, 400);

      const data = await response.json();
      assert.ok(data.error);
    });
  });

  describe('GET /api/sportsbooks', () => {
    it('should return list of available sportsbooks', async () => {
      const response = await fetch(`${baseUrl}/api/sportsbooks`);

      assert.strictEqual(response.status, 200);

      const data = await response.json();
      assert.ok(Array.isArray(data.sportsbooks));
      assert.ok(data.league);
    });

    it('should include sportsbook names from odds data', async () => {
      const response = await fetch(`${baseUrl}/api/sportsbooks`);
      const data = await response.json();

      // Should contain DraftKings from our mock data
      assert.ok(data.sportsbooks.length > 0);
    });
  });

  describe('GET /api/cache/stats', () => {
    it('should return cache statistics', async () => {
      const response = await fetch(`${baseUrl}/api/cache/stats`);

      // Cache may not be connected in test mode, but should return something
      assert.ok(response.status < 500);

      if (response.status === 200) {
        const data = await response.json();
        assert.ok(typeof data === 'object');
      }
    });
  });

  describe('DELETE /api/cache/clear/:pattern', () => {
    it('should clear cache by pattern', async () => {
      const response = await fetch(`${baseUrl}/api/cache/clear/teams:*`, {
        method: 'DELETE'
      });

      // Should succeed even if cache is not connected in test mode
      assert.ok(response.status < 500);

      if (response.status === 200) {
        const data = await response.json();
        assert.strictEqual(data.cleared, true);
        assert.ok(data.pattern);
        assert.ok(typeof data.count === 'number');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle server errors gracefully', async () => {
      // This would test error scenarios
      const response = await fetch(`${baseUrl}/api/scores/nba`);
      // In a real scenario, we'd trigger errors to test error middleware
      assert.ok(response.status < 500);
    });

    it('should return JSON for all endpoints', async () => {
      const endpoints = [
        '/api/scores/nba',
        '/api/odds/nba',
        '/api/standings/nba',
        '/api/news/nba',
        '/api/teams/nba',
        '/api/sportsbooks',
        '/api/cache/stats'
      ];

      for (const endpoint of endpoints) {
        const response = await fetch(`${baseUrl}${endpoint}`);
        const contentType = response.headers.get('content-type');

        assert.ok(contentType && contentType.includes('application/json'),
          `${endpoint} should return JSON`);
      }
    });
  });
});
