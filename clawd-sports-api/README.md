# Clawd Sports API

Sports data aggregation service for Clawd Bot. Fetches data from ESPN and The Odds API, caches with Redis, and stores in Supabase.

## New Endpoints (Phase 1)

### Teams
- GET /api/teams/:league - List all teams (cached 1hr)
- GET /api/team/:league/:id - Team details (checks DB first, then ESPN)

### Players
- GET /api/player/:league/:id - Player details from ESPN

### Odds
- GET /api/odds/game/:gameId - Specific game odds
- GET /api/EOF
