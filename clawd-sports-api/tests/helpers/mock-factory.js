/**
 * Mock Factory
 * Factory functions for creating test data and mock objects.
 */

/**
 * Creates a mock ESPN game event
 * @param {Object} overrides - Properties to override in the mock
 * @returns {Object} Mock ESPN event
 */
export function createMockESPNEvent(overrides = {}) {
  return {
    id: '401673744',
    date: new Date().toISOString(),
    name: 'Kansas City Chiefs at Houston Texans',
    shortName: 'KC @ HOU',
    status: {
      type: { id: '3', name: 'In Progress', state: 'in', detail: 'Q2' },
      period: 2,
      displayClock: '8:45',
      type: { id: '3', state: 'in' }
    },
    competitions: [
      {
        id: '401673744',
        competitors: [
          {
            id: '34',
            homeAway: 'home',
            team: {
              id: '34',
              uid: 's:20~l:28~t:34',
              displayName: 'Kansas City Chiefs',
              abbreviation: 'KC',
              logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/kc.png'
            },
            score: '14',
            records: [{ summary: '12-3' }],
            statistics: []
          },
          {
            id: '25',
            homeAway: 'away',
            team: {
              id: '25',
              uid: 's:20~l:28~t:25',
              displayName: 'Houston Texans',
              abbreviation: 'HOU',
              logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/hou.png'
            },
            score: '10',
            records: [{ summary: '10-7' }],
            statistics: []
          }
        ],
        venue: {
          id: '1',
          fullName: 'Arrowhead Stadium',
          address: { city: 'Kansas City', state: 'MO' }
        },
        broadcasts: [{ names: ['CBS'] }]
      }
    ],
    ...overrides
  };
}

/**
 * Creates a mock ESPN team
 * @param {Object} overrides - Properties to override in the mock
 * @returns {Object} Mock ESPN team
 */
export function createMockESPNTeam(overrides = {}) {
  return {
    id: '34',
    uid: 's:20~l:28~t:34',
    displayName: 'Kansas City Chiefs',
    abbreviation: 'KC',
    logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/kc.png',
    color: '#E31837',
    location: 'Kansas City',
    ...overrides
  };
}

/**
 * Creates a mock ESPN player
 * @param {Object} overrides - Properties to override in the mock
 * @returns {Object} Mock ESPN player
 */
export function createMockESPNPlayer(overrides = {}) {
  return {
    id: '4362537',
    guid: '755e8314-64fc-ab60-7536-1f703a84e4e6',
    displayName: 'Patrick Mahomes',
    shortName: 'P. Mahomes',
    firstName: 'Patrick',
    lastName: 'Mahomes',
    fullName: 'Patrick Mahomes',
    jersey: '15',
    position: { id: '24', name: 'QB', abbreviation: 'QB' },
    headshot: 'https://a.espncdn.com/i/headshots/nfl/players/full/4362537.png',
    height: '6\' 3"',
    weight: 230,
    age: 28,
    ...overrides
  };
}

/**
 * Creates a mock ESPN news article
 * @param {Object} overrides - Properties to override in the mock
 * @returns {Object} Mock ESPN article
 */
export function createMockESPNNewsArticle(overrides = {}) {
  return {
    id: '12345',
    headline: 'Test Headline',
    description: 'Test description of the article',
    links: {
      web: { href: 'https://example.com/article' },
      api: { news: 'https://example.com/api/news' }
    },
    images: [
      {
        url: 'https://example.com/image.jpg',
        name: 'Test Image',
        type: 'image'
      }
    ],
    published: '2025-01-12T12:00:00Z',
    byline: 'Test Author',
    type: 'story',
    ...overrides
  };
}

/**
 * Creates a mock betting odds response
 * @param {Object} overrides - Properties to override in the mock
 * @returns {Object} Mock odds data
 */
export function createMockOddsData(overrides = {}) {
  return {
    id: 'test-game-id',
    sport_key: 'americanfootball_nfl',
    sport_title: 'NFL',
    commence_time: new Date(Date.now() + 86400000).toISOString(),
    home_team: 'Kansas City Chiefs',
    away_team: 'Houston Texans',
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
              {
                name: 'Kansas City Chiefs',
                price: -250,
                point: null
              },
              {
                name: 'Houston Texans',
                price: 200,
                point: null
              }
            ]
          },
          {
            key: 'spreads',
            last_update: new Date().toISOString(),
            outcomes: [
              {
                name: 'Kansas City Chiefs',
                price: -110,
                point: -3.5
              },
              {
                name: 'Houston Texans',
                price: -110,
                point: 3.5
              }
            ]
          }
        ]
      }
    ],
    ...overrides
  };
}

/**
 * Creates a mock Supabase query response
 * @param {Object} data - Data to return
 * @param {Object} error - Error to return
 * @returns {Object} Mock Supabase response
 */
export function createMockSupabaseResponse(data = null, error = null) {
  const response = {
    data,
    error,
    count: data?.length ?? 0,
    status: error ? 400 : 200,
    statusText: error ? 'Bad Request' : 'OK'
  };

  // Add chain methods
  response.select = () => response;
  response.insert = () => response;
  response.update = () => response;
  response.delete = () => response;
  response.eq = () => response;
  response.gte = () => response;
  response.lte = () => response;
  response.order = () => response;
  response.limit = () => response;
  response.single = () => response;
  response.maybeSingle = () => response;
  response.range = () => response;
  response.in = () => response;
  response.not = () => response;
  response.is = () => response;
  response.or = () => response;
  response.like = () => response;
  response.ilike = () => response;
  response.overlaps = () => response;
  response.contains = () => response;
  response.containedBy = () => response;
  response.rangeGte = () => response;
  response.rangeLte = () => response;
  response.rangeAdjacent = () => response;
  response.overlaps = () => response;
  response.textSearch = () => response;
  response.filter = () => response;
  response.match = () => response;
  response.neq = () => response;
  response.gt = () => response;
  response.lt = () => response;

  return response;
}

/**
 * Creates a mock Express request
 * @param {Object} overrides - Properties to override
 * @returns {Object} Mock Express request
 */
export function createMockRequest(overrides = {}) {
  return {
    method: 'GET',
    url: '/api/scores/nfl',
    params: {},
    query: {},
    body: {},
    headers: {},
    ip: '127.0.0.1',
    ...overrides
  };
}

/**
 * Creates a mock Express response
 * @returns {Object} Mock Express response
 */
export function createMockResponse() {
  const res = {
    statusCode: 200,
    body: null,
    headers: {},

    status(code) {
      this.statusCode = code;
      return this;
    },

    json(data) {
      this.body = data;
      return this;
    },

    send(data) {
      this.body = data;
      return this;
    },

    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },

    getHeader(name) {
      return this.headers[name];
    }
  };

  return res;
}

/**
 * Creates a mock logger for testing
 * @returns {Object} Mock logger
 */
export function createMockLogger() {
  const logs = {
    error: [],
    warn: [],
    info: [],
    http: [],
    debug: []
  };

  return {
    error: (msg, meta) => logs.error.push({ msg, meta }),
    warn: (msg, meta) => logs.warn.push({ msg, meta }),
    info: (msg, meta) => logs.info.push({ msg, meta }),
    http: (msg, meta) => logs.http.push({ msg, meta }),
    debug: (msg, meta) => logs.debug.push({ msg, meta }),
    getLogs: () => logs,
    clearLogs: () => {
      logs.error = [];
      logs.warn = [];
      logs.info = [];
      logs.http = [];
      logs.debug = [];
    }
  };
}

/**
 * Creates mock Redis client
 * @returns {Object} Mock Redis client
 */
export function createMockRedis() {
  const store = new Map();

  return {
    get: async (key) => store.get(key) || null,
    set: async (key, value) => store.set(key, value),
    setex: async (key, seconds, value) => store.set(key, value),
    del: async (key) => store.delete(key),
    exists: async (key) => store.has(key) ? 1 : 0,
    expire: async (key, seconds) => {},
    flushall: async () => store.clear(),
    keys: async (pattern) => Array.from(store.keys()).filter(k =>
      pattern.replace(/\*/g, '').split('').every(c => k.includes(c))
    ),
    // Add other common Redis methods
    hget: async (key, field) => {
      const hash = store.get(key);
      return hash?.[field] || null;
    },
    hset: async (key, field, value) => {
      const hash = store.get(key) || {};
      hash[field] = value;
      store.set(key, hash);
    },
    hgetall: async (key) => store.get(key) || {},
    incr: async (key) => {
      const val = (store.get(key) || 0) + 1;
      store.set(key, val);
      return val;
    },
    // Circuit breaker related
    _getStore: () => store
  };
}

/**
 * Helper to create an error response
 * @param {number} status - HTTP status code
 * @param {string} message - Error message
 * @returns {Object} Error response
 */
export function createErrorResponse(status, message) {
  const error = new Error(message);
  error.response = { status, data: { message } };
  error.status = status;
  return error;
}

// Export all factories as an object for convenience
export default {
  createMockESPNEvent,
  createMockESPNTeam,
  createMockESPNPlayer,
  createMockESPNNewsArticle,
  createMockOddsData,
  createMockSupabaseResponse,
  createMockRequest,
  createMockResponse,
  createMockLogger,
  createMockRedis,
  createErrorResponse
};
