/**
 * Odds API Client Unit Tests
 * Tests for The Odds API client functionality
 */

import { describe, it, mock, before } from 'node:test';
import assert from 'node:assert';
import axios from 'axios';

// Set API key before importing the module
process.env.THE_ODDS_API_KEY = 'test-api-key';

// Mock axios before importing odds client
const mockInstance = {
  interceptors: {
    request: { use: () => {} },
    response: { use: () => {} }
  },
  request: async (config) => {
    // Return mock data based on URL
    if (config.url?.includes('/sports/') && config.url?.includes('/odds')) {
      return {
        data: [
          {
            id: 'test-game-1',
            sport_key: 'basketball_nba',
            sport_title: 'NBA',
            commence_time: new Date(Date.now() + 3600000).toISOString(),
            home_team: 'Boston Celtics',
            away_team: 'Los Angeles Lakers',
            bookmakers: [
              {
                key: 'draftkings',
                title: 'DraftKings',
                last_update: new Date().toISOString(),
                markets: [
                  {
                    key: 'h2h',
                    last_update: new Date().toISOString(),
                    outcomes: [
                      { name: 'Boston Celtics', price: -150 },
                      { name: 'Los Angeles Lakers', price: 130 }
                    ]
                  },
                  {
                    key: 'spreads',
                    last_update: new Date().toISOString(),
                    outcomes: [
                      { name: 'Boston Celtics', price: -110, point: -3.5 },
                      { name: 'Los Angeles Lakers', price: -110, point: 3.5 }
                    ]
                  },
                  {
                    key: 'totals',
                    last_update: new Date().toISOString(),
                    outcomes: [
                      { name: 'Over', price: -110, point: 230.5 },
                      { name: 'Under', price: -110, point: 230.5 }
                    ]
                  }
                ]
              },
              {
                key: 'fanduel',
                title: 'FanDuel',
                last_update: new Date().toISOString(),
                markets: [
                  {
                    key: 'h2h',
                    last_update: new Date().toISOString(),
                    outcomes: [
                      { name: 'Boston Celtics', price: -145 },
                      { name: 'Los Angeles Lakers', price: 125 }
                    ]
                  }
                ]
              }
            ]
          },
          {
            id: 'test-game-2',
            sport_key: 'basketball_nba',
            sport_title: 'NBA',
            commence_time: new Date(Date.now() + 7200000).toISOString(),
            home_team: 'Golden State Warriors',
            away_team: 'Phoenix Suns',
            bookmakers: [
              {
                key: 'draftkings',
                title: 'DraftKings',
                last_update: new Date().toISOString(),
                markets: [
                  {
                    key: 'h2h',
                    last_update: new Date().toISOString(),
                    outcomes: [
                      { name: 'Golden State Warriors', price: -200 },
                      { name: 'Phoenix Suns', price: 170 }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      };
    }
    if (config.url?.includes('/scores')) {
      return { data: [] };
    }
    return { data: [] };
  }
};

mock.method(axios, 'create', () => mockInstance);

// Now import the odds client
import OddsClient from '../../src/clients/odds-client.js';

describe('OddsClient', () => {
  let client;

  before(() => {
    client = new OddsClient({ timeout: 5000, maxRetries: 2 });
  });

  describe('Initialization', () => {
    it('should create client with default options', () => {
      const defaultClient = new OddsClient();
      assert.ok(defaultClient);
      assert.strictEqual(typeof defaultClient.getOdds, 'function');
    });

    it('should create client with custom options', () => {
      assert.strictEqual(client.timeout, 5000);
      assert.strictEqual(client.maxRetries, 2);
    });

    it('should have circuit breaker configured', () => {
      assert.ok(client._isCircuitOpen !== undefined);
      assert.strictEqual(typeof client._isCircuitOpen, 'function');
    });
  });

  describe('_getLeagueKey', () => {
    it('should return correct key for valid leagues', () => {
      assert.strictEqual(client._getLeagueKey('nfl'), 'americanfootball_nfl');
      assert.strictEqual(client._getLeagueKey('nba'), 'basketball_nba');
      assert.strictEqual(client._getLeagueKey('mlb'), 'baseball_mlb');
      assert.strictEqual(client._getLeagueKey('nhl'), 'icehockey_nhl');
    });

    it('should throw error for invalid league', () => {
      assert.throws(
        () => client._getLeagueKey('invalid'),
        /Invalid league/
      );
    });
  });

  describe('getOdds', () => {
    it('should fetch and normalize odds data', async () => {
      const result = await client.getOdds('nba');

      assert.ok(result);
      assert.strictEqual(result.sport, 'nba');
      assert.strictEqual(result.league, 'NBA');
      assert.ok(Array.isArray(result.games));
      assert.ok(result.games.length > 0);
    });

    it('should normalize game data correctly', async () => {
      const result = await client.getOdds('nba');
      const game = result.games[0];

      assert.ok(game.espnId);
      assert.ok(game.homeTeam);
      assert.ok(game.awayTeam);
      assert.ok(game.commenceTime);
      assert.ok(Array.isArray(game.bookmakers));
    });

    it('should include moneyline odds', async () => {
      const result = await client.getOdds('nba');
      const game = result.games[0];

      const draftkings = game.bookmakers.find(b => b.key === 'draftkings');
      assert.ok(draftkings);

      const moneyline = draftkings.markets.find(m => m.key === 'h2h');
      assert.ok(moneyline);
      assert.ok(moneyline.outcomes.length >= 2);
    });

    it('should include spread odds', async () => {
      const result = await client.getOdds('nba');
      const game = result.games[0];

      const draftkings = game.bookmakers.find(b => b.key === 'draftkings');
      assert.ok(draftkings);

      const spreads = draftkings.markets.find(m => m.key === 'spreads');
      assert.ok(spreads);
      assert.ok(spreads.outcomes[0].point);
    });

    it('should include totals', async () => {
      const result = await client.getOdds('nba');
      const game = result.games[0];

      const draftkings = game.bookmakers.find(b => b.key === 'draftkings');
      assert.ok(draftkings);

      const totals = draftkings.markets.find(m => m.key === 'totals');
      assert.ok(totals);
      assert.ok(totals.outcomes[0].point);
    });

    it('should throw error for invalid league', async () => {
      await assert.rejects(
        async () => await client.getOdds('invalid-league'),
        /Invalid league/
      );
    });

    it('should support regions parameter', async () => {
      const result = await client.getOdds('nba', { regions: 'us' });
      assert.ok(result);
    });

    it('should support markets parameter', async () => {
      const result = await client.getOdds('nba', { markets: 'h2h,spreads' });
      assert.ok(result);
    });
  });

  describe('_normalizeOddsData', () => {
    it('should normalize odds with all fields', () => {
      const mockOdds = [
        {
          id: 'test-123',
          sport_key: 'basketball_nba',
          commence_time: '2025-01-17T19:00:00Z',
          home_team: 'Boston Celtics',
          away_team: 'Los Angeles Lakers',
          bookmakers: [
            {
              key: 'draftkings',
              title: 'DraftKings',
              markets: [
                {
                  key: 'h2h',
                  outcomes: [
                    { name: 'Boston Celtics', price: -150 }
                  ]
                }
              ]
            }
          ]
        }
      ];

      const result = client._normalizeOddsData(mockOdds, 'nba');

      assert.strictEqual(result.sport, 'nba');
      assert.strictEqual(result.league, 'NBA');
      assert.ok(Array.isArray(result.games));
      assert.strictEqual(result.games.length, 1);
    });

    it('should normalize game data', () => {
      const mockGame = {
        id: 'test-123',
        sport_key: 'basketball_nba',
        commence_time: '2025-01-17T19:00:00Z',
        home_team: 'Boston Celtics',
        away_team: 'Los Angeles Lakers',
        bookmakers: []
      };

      const result = client._normalizeGame(mockGame, 'nba');

      assert.strictEqual(result.espnId, 'test-123');
      assert.strictEqual(result.homeTeam, 'Boston Celtics');
      assert.strictEqual(result.awayTeam, 'Los Angeles Lakers');
      assert.ok(result.commenceTime);
    });

    it('should handle empty bookmakers array', () => {
      const mockGame = {
        id: 'test-456',
        sport_key: 'basketball_nba',
        commence_time: '2025-01-17T19:00:00Z',
        home_team: 'Team A',
        away_team: 'Team B',
        bookmakers: []
      };

      const result = client._normalizeGame(mockGame, 'nba');

      assert.strictEqual(result.espnId, 'test-456');
      assert.deepStrictEqual(result.bookmakers, []);
    });
  });

  describe('_normalizeBookmaker', () => {
    it('should normalize bookmaker data', () => {
      const mockBookmaker = {
        key: 'draftkings',
        title: 'DraftKings',
        last_update: '2025-01-17T12:00:00Z',
        markets: [
          {
            key: 'h2h',
            outcomes: [
              { name: 'Team A', price: -150 }
            ]
          }
        ]
      };

      const result = client._normalizeBookmaker(mockBookmaker);

      assert.strictEqual(result.key, 'draftkings');
      assert.strictEqual(result.title, 'DraftKings');
      assert.ok(result.lastUpdate);
      assert.ok(Array.isArray(result.markets));
    });
  });

  describe('_normalizeMarket', () => {
    it('should normalize h2h market', () => {
      const mockMarket = {
        key: 'h2h',
        last_update: '2025-01-17T12:00:00Z',
        outcomes: [
          { name: 'Boston Celtics', price: -150 },
          { name: 'Los Angeles Lakers', price: 130 }
        ]
      };

      const result = client._normalizeMarket(mockMarket);

      assert.strictEqual(result.key, 'h2h');
      assert.strictEqual(result.outcomes.length, 2);
      assert.strictEqual(result.outcomes[0].name, 'Boston Celtics');
      assert.strictEqual(result.outcomes[0].price, -150);
    });

    it('should normalize spreads market', () => {
      const mockMarket = {
        key: 'spreads',
        outcomes: [
          { name: 'Boston Celtics', price: -110, point: -3.5 },
          { name: 'Los Angeles Lakers', price: -110, point: 3.5 }
        ]
      };

      const result = client._normalizeMarket(mockMarket);

      assert.strictEqual(result.key, 'spreads');
      assert.strictEqual(result.outcomes[0].point, -3.5);
      assert.strictEqual(result.outcomes[1].point, 3.5);
    });

    it('should normalize totals market', () => {
      const mockMarket = {
        key: 'totals',
        outcomes: [
          { name: 'Over', price: -110, point: 230.5 },
          { name: 'Under', price: -110, point: 230.5 }
        ]
      };

      const result = client._normalizeMarket(mockMarket);

      assert.strictEqual(result.key, 'totals');
      assert.strictEqual(result.outcomes[0].point, 230.5);
    });

    it('should handle missing point field', () => {
      const mockMarket = {
        key: 'h2h',
        outcomes: [
          { name: 'Team A', price: -150 }
        ]
      };

      const result = client._normalizeMarket(mockMarket);

      assert.strictEqual(result.outcomes[0].point, null);
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when API is accessible', async () => {
      const result = await client.healthCheck();

      assert.strictEqual(result.status, 'healthy');
      assert.ok(typeof result.latency === 'number');
      assert.strictEqual(result.circuitBreakerOpen, false);
    });

    it('should return health check response structure', async () => {
      const result = await client.healthCheck();

      assert.ok(result);
      assert.ok('status' in result);
      assert.ok('latency' in result);
    });
  });

  describe('Circuit Breaker', () => {
    it('should be initially closed', () => {
      assert.strictEqual(client._isCircuitOpen(), false);
    });

    it('should have circuit breaker method', () => {
      assert.strictEqual(typeof client._isCircuitOpen, 'function');
    });
  });

  describe('Error Handling', () => {
    it('should handle empty response from API', async () => {
      const result = client._normalizeOddsData([], 'nba');

      assert.strictEqual(result.sport, 'nba');
      assert.deepStrictEqual(result.games, []);
    });
  });
});
