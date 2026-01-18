# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

## Repository Overview

Clawd Bot is a context-aware AI assistant delivered via Telegram that automatically switches between specialized LLMs based on daily schedules and conversation topics.

**Current Implementation Status:**
- ✅ **Sports Data Service** (clawd-sports-api/) - Fully implemented (4,233 lines)
- ✅ **Main Telegram Bot** (clawd-bot/) - Fully implemented with Telegraf + OpenRouter
- ⏳ **Firecrawl Service** - Optional, not yet implemented

## Sports Data Service Architecture

The implemented service is a standalone Node.js API that aggregates sports data from ESPN (public API) and The Odds API v4. Data persists to self-hosted Supabase with Redis tiered caching.

**Tech Stack:**
- Runtime: Node.js 20.11.0 LTS (ES modules)
- Server: Express 4.18.2
- Database: Supabase (@supabase/supabase-js 2.39.0)
- Cache: Redis 7.x (ioredis 5.3.2)
- Logging: Winston 3.11.0
- Testing: Node.js native test runner + c8 for coverage

**Key Patterns:**
- Repository pattern with generic BaseRepository (409 lines)
- Circuit breaker for external APIs (opens after 5 failures, 30s reset)
- Dependency injection via `app.locals`
- Non-blocking database sync (fire-and-forget)

**Circuit Breaker Configuration:**
```
ESPN Client:   Opens after 5 consecutive failures, resets after 30s
Odds Client:   Opens after 5 consecutive failures, resets after 30s
```

## Development Commands

```bash
cd clawd-sports-api

# Development (watch mode with --watch flag)
npm run dev

# Production
npm run start

# Testing
npm test                  # All tests with coverage
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests only
npm run test:watch        # Watch mode for TDD
npm run test:ci           # JSON output for CI/CD

# Docker
docker compose up -d --build    # Build and start (Redis + API)
docker compose down             # Stop services
docker logs clawd-sports-api -f # Follow logs
```

## Project Structure

```
clawd-bot/
├── src/
│   ├── server.js               # Entry point (HTTP server for health checks)
│   ├── bot.js                  # Main bot logic with Telegraf
│   ├── clients/
│   │   ├── openrouter-client.js # OpenRouter API wrapper
│   │   └── sports-client.js    # Sports API client wrapper
│   ├── services/
│   │   └── context-router.js   # Time-based LLM routing logic
│   └── utils/
│       └── logger.js           # Winston configuration
├── Dockerfile                  # Multi-stage build (node:20-alpine)
├── docker-compose.yml          # Bot service with network
└── package.json

clawd-sports-api/
├── src/
│   ├── server.js               # Entry point (HTTP server)
│   ├── app.js                  # Express app + routes (535 lines)
│   ├── clients/
│   │   ├── espn-client.js      # ESPN API wrapper + circuit breaker
│   │   ├── odds-client.js      # The Odds API wrapper
│   │   └── standings-scraper.js # Web scraper (no API for standings)
│   ├── repositories/
│   │   ├── BaseRepository.js   # Generic CRUD (409 lines)
│   │   ├── GamesRepository.js
│   │   ├── TeamsRepository.js
│   │   ├── OddsRepository.js
│   │   └── NewsRepository.js
│   ├── config/
│   │   ├── database.js         # Supabase client setup
│   │   └── cache.js            # Redis client + TTL config
│   ├── middleware/
│   │   └── cacheMiddleware.js  # Response caching
│   └── utils/
│       └── logger.js           # Winston configuration
├── tests/                      # 3,099 lines of test code
│   ├── setup.js                # Test environment config
│   ├── helpers/
│   │   ├── test-utils.js       # Custom assertions (390 lines)
│   │   └── mock-factory.js     # Data factories
│   ├── unit/                   # 7 unit test files
│   └── integration/            # API endpoint tests
├── supabase/migrations/
│   └── 20240117000000_create_sports_tables.sql
├── Dockerfile                  # Multi-stage build (node:20.11.0-alpine)
├── docker-compose.yml          # Redis + sports-api service
├── .c8rc.json                  # Coverage thresholds (80% required)
└── package.json
```

**Note:** The `controllers/`, `services/`, and `models/` directories exist but are empty. Business logic currently lives in routes (`app.js`) and repositories.

## About the GitHub Repository

The repository at https://github.com/clawdbot/clawdbot is a **different project** - a production multi-channel AI assistant platform. It is **NOT** the codebase for this project.

We use it only as a reference for:
- Telegram bot patterns
- Session management patterns
- Skills architecture ideas

**Our implementation is custom-built** for our specific requirements using:
- Telegraf (not grammY)
- OpenRouter (not direct Anthropic/OpenAI APIs)
- Node.js 20 (not TypeScript)
- Simple architecture (not Pi Agent framework)

## API Endpoints

**Health & Operations:**
```
GET /health                    # Deep health check with latency per dependency
GET /api/cache/stats           # Cache hit/miss statistics
DELETE /api/cache/clear/:pattern  # Clear cache by pattern
```

**Sports Data:**
```
GET /api/scores/:league        # Live scores from ESPN
GET /api/odds/:league          # Betting odds from The Odds API
GET /api/odds/game/:gameId     # Specific game odds
GET /api/odds/best/:league     # Best odds across sportsbooks
GET /api/standings/:league     # League standings (web scraped)
GET /api/news/:league          # Sports news from ESPN
GET /api/teams/:league         # Team list
GET /api/team/:league/:teamId  # Team details
GET /api/player/:league/:playerId  # Player stats + headshot
GET /api/sportsbooks           # Available sportsbooks
```

**Supported Leagues:** nfl, nba, mlb, nhl, ncaaf, ncaab

## Caching Strategy

| Data Type | TTL | Redis Key Pattern |
|-----------|-----|-------------------|
| Live scores | 30s | `scores:{league}` |
| Betting odds | 5 min | `odds:{league}` |
| Game odds | 5 min | `odds:game:{gameId}` |
| Best odds | 5 min | `odds:best:{league}` |
| Standings | 6 hours | `standings:{league}` |
| Team list | 1 day | `teams:{league}` |
| Team details | 1 day | `team:{league}:{id}` |
| Player stats | 7 days | `player:{league}:{id}` |
| News | 1 hour | `news:{league}` |

## Database Schema (Supabase)

**Tables:**
- `teams` - ESPN team data (espn_id, sport, logo, colors)
- `players` - Athletes (headshot_url, position, stats)
- `games` - Scores, schedules, status (home_team_id, away_team_id FKs)
- `odds` - Betting odds (game_id FK, sportsbook, market_type)
- `player_props` - Player prop bets
- `news` - Sports articles (espn_id, headline, published_at)

**Indexes:**
- Composite on `(sport, status)` and `(sport, date)`
- Partial indexes for recent data (last 7 days)

**Row Level Security (RLS):**
- Enabled on all tables
- Read access: all authenticated users
- Write access: service role key only

## Environment Variables

**Required:**
```bash
SUPABASE_URL="URL"
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...  # Admin access (bypasses RLS)
THE_ODDS_API_KEY="API_KEY"
```

**Optional:**
```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
ESPN_API_TIMEOUT=10000        # Default: 10s
ODDS_API_REQUESTS_PER_DAY=15  # Rate limiting
CACHE_TTL_SCORES=30           # Override default TTLs
```

## Supabase Connection

**Self-hosted on Ubuntu VPS:**
- Host: supabase.seangreen.cc (89.117.150.95)
- SSH: `ssh sean-ubuntu-vps` or `ssh -i ~/.ssh/sean_ubuntu_vps sean@89.117.150.95`
- See `../sean-ubuntu/SEANUBUNTU.md` for full connection details

**Client Usage:**
```javascript
const { createClient } = require('@supabase/supabase-js');

// Admin client (bypasses RLS)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Query example
const { data, error } = await supabase
  .from('games')
  .select('*')
  .eq('sport', 'nfl');
```

## Testing Strategy

**Framework:** Node.js native test runner (`node:test`)

**Coverage:** c8 (Istanbul wrapper)
- Thresholds: 80% lines/functions/statements, 69% branches
- Reports: HTML, JSON, text

**Test Structure:**
```
tests/
├── setup.js                    # Environment configuration
├── helpers/
│   ├── test-utils.js          # Custom assertions (assertThrowsAsync, assertHasProperties, etc.)
│   └── mock-factory.js        # Data factories
├── unit/                       # Isolated tests with mocked dependencies
└── integration/                # API endpoint tests
```

**Custom Test Utilities** (`test-utils.js`):
- `assertThrowsAsync(fn, message)` - Async error assertions
- `assertHasProperties(obj, props)` - Schema validation
- `mockTime(date)` - Time mocking
- `spy(obj, method)` - Method call tracking
- `captureConsole()` - Console output capture

**Test Naming:**
```javascript
// Unit: [Unit].should[ExpectedBehavior] when[StateUnderTest]
describe('ESPNClient.getScoreboard', () => {
  it('should return normalized game data when API responds successfully', () => {});
  it('should throw error when circuit breaker is open', () => {});
});

// Integration: [Feature].should[ExpectedBehavior]
describe('GET /api/scores/:league', () => {
  it('should return cached scores when available', () => {});
});
```

## Adding New Features

**For New API Endpoints:**
1. Add route handler in `app.js`
2. Apply cache middleware with appropriate TTL
3. Call repository/client methods
4. Add error handling with `next(err)`
5. Sync to database non-blocking if needed
6. Write integration test in `tests/integration/`

**For Database Changes:**
1. Create migration in `supabase/migrations/`
2. Add RLS policies
3. Add indexes for query patterns
4. Update repository methods
5. Test with both anon and service role keys

**For External API Integration:**
1. Create client in `src/clients/`
2. Implement circuit breaker pattern (see `espn-client.js`)
3. Add unit tests with mocked axios
4. Configure timeout and retry logic

## Known Issues

**Tests:**
- Coverage below threshold (57% vs 80% required)
- 4 failing tests in `standings-scraper.test.js`
- Some repository methods untested

**Architecture:**
- Empty `controllers/`, `services/`, `models/` directories
- No service layer (business logic mixed with routes in `app.js`)
- No input validation middleware
- No rate limiting

## Code Conventions

- **Files:** kebab-case (`espn-client.js`)
- **Classes:** PascalCase (`ESPNClient`)
- **Functions:** camelCase (`getScoreboard`)
- **Constants:** UPPER_SNAKE_CASE (`ESPN_BASE_URL`)
- ES modules (import/export)
- Async/await throughout
- JSDoc on key functions

## Deployment

**Docker:**
- Multi-stage build (deps → builder → runner)
- Non-root user (UID 1001)
- Health check on `/health`
- Alpine Linux (node:20.11.0-alpine)

**Docker Compose:**
- Redis 7.2-alpine with persistence
- Sports API depends on Redis (health check)
- Custom network (clawd-sports-network)

## Future Services (Not Yet Implemented)

Refer to `PRD.md` for complete specifications of:
- **Firecrawl Service** (Optional - Web scraping for general queries during non-sports hours)

**Note:** The main Telegram bot (clawd-bot/) is fully implemented with:
- Time-based LLM routing via OpenRouter
- Sports data integration via clawd-sports-api
- Daily schedule with automatic context switching
- All bot commands (/start, /help, /mode, /scores, /nfl, /nba, etc.)
