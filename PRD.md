# Clawd Bot - Product Requirements Document
## https://clawd.bot

---

## 📋 Executive Summary

Clawd Bot is an intelligent, **context-aware AI assistant** that automatically switches between specialized LLMs based on your daily schedule and conversation topics. Powered by **OpenRouter** for multi-model access, **ESPN API** + **The Odds API** for sports data, **Firecrawl** for general web scraping, delivered via **Telegram**, and deployed in **Docker** on Ubuntu VPS.

---

## 🎯 Implementation Approach

**Important**: This project uses a **custom-built implementation** approach:
- We are **NOT** using the `clawdbot/clawdbot` GitHub repository as a base
- That repository is a different product (multi-channel AI assistant platform)
- We are building from scratch using Telegraf + OpenRouter for simplicity and focus on sports

**Reference**: https://github.com/clawdbot/clawdbot (different project, useful for patterns only)

---

## ✅ Confirmed Decisions

| Component | Choice | Status |
|-----------|--------|--------|
| **Bot Platform** | Telegram | ✅ Confirmed |
| **LLM Provider** | OpenRouter (Multi-Model) | ✅ Confirmed |
| **Sports Data** | ESPN API + The Odds API | ✅ Confirmed |
| **Web Scraping** | Firecrawl (General Use) | ✅ Confirmed |
| **Database** | Supabase (Self-Hosted) | ✅ Confirmed |
| **Installation** | Docker Containers | ✅ Confirmed |
| **Server** | Ubuntu VPS | ✅ Confirmed |

---

## 🗓️ Your Daily Schedule & LLM Mapping

| Time (CST) | Activity | Recommended Free LLM | Data Sources |
|------------|----------|---------------------|--------------|
| **5:00 AM - 6:30 AM** | Trading Prep (NinjaTrader) | `google/gemma-2-9b-it:free` | Firecrawl (if needed) |
| **7:15 AM - 8:15 AM** | Exercise Regimen | `meta-llama/llama-3.2-3b-instruct:free` | None |
| **8:30 AM - 9:30 AM** | Active Trading | `google/gemma-2-9b-it:free` | Firecrawl (if needed) |
| **9:30 AM - 2:00 PM** | Productivity & Coding | `mistralai/mistral-7b-instruct:free` | Firecrawl (if needed) |
| **After 2:00 PM** | 🏈 Sports Updates | `meta-llama/llama-3.2-3b-instruct:free` | **ESPN API + The Odds API** |

---

## 🏈 Sports Mode Architecture

### Overview

After 2:00 PM CST, Clawd switches to **Sports Mode** powered by two professional APIs:

| API | Purpose | Data Provided |
|-----|---------|---------------|
| **ESPN API** | Live sports data | Scores, news, player stats, player images, standings |
| **The Odds API** | Betting data | Sportsbook odds, prop bets (FanDuel, DraftKings) |

### ESPN API Integration (Public API)

Based on [pseudo-r/Public-ESPN-API](https://github.com/pseudo-r/Public-ESPN-API):

```
📊 ESPN API Endpoints:
├── /sports/{sport}/leagues - League information
├── /sports/{sport}/news - Latest news articles  
├── /scoreboard - Live game scores
├── /teams/{teamId} - Team details & roster
├── /athletes/{athleteId} - Player stats & images
├── /standings - Current standings
└── /schedule - Upcoming games
```

**Supported Sports:**
- 🏈 NFL (football)
- 🏀 NBA (basketball)
- ⚾ MLB (baseball)
- 🏒 NHL (hockey)
- 🏈 NCAAF (college football)
- 🏀 NCAAB (college basketball)

### The Odds API Integration

From [the-odds-api.com](https://the-odds-api.com):

```
🎰 The Odds API Endpoints:
├── /sports - List of available sports
├── /sports/{sport}/odds - Current odds from sportsbooks
├── /sports/{sport}/scores - Live & recent scores
├── /sports/{sport}/events - Upcoming events
└── /sports/{sport}/events/{eventId}/odds - Specific event odds
```

**Supported Sportsbooks:**
- 💰 FanDuel
- 💰 DraftKings  
- 💰 BetMGM
- 💰 Caesars
- 💰 PointsBet
- 💰 And 40+ more...

**Odds Types:**
- Moneyline (h2h)
- Spreads
- Totals (over/under)
- Player Props
- Outrights (futures)

---

## 🔥 Firecrawl - General Web Scraping

Firecrawl is **NOT used for sports data**. It's available for general web scraping during your daily schedule when needed:

| Use Case | When |
|----------|------|
| Trading news/research | 5:00 AM - 9:30 AM |
| Productivity research | 9:30 AM - 2:00 PM |
| General web queries | Anytime on request |

---

## 🏗️ Complete System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                 UBUNTU VPS                                      │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                            DOCKER ENGINE                                  │  │
│  │                                                                           │  │
│  │  ┌─────────────────────────────────────────────────────────────────────┐  │  │
│  │  │                      CLAWD BOT CONTAINER                            │  │  │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐  │  │  │
│  │  │  │  Telegram   │  │  OpenRouter │  │     Context Router          │  │  │  │
│  │  │  │  Bot SDK    │  │   Client    │  │  • Time-based switching     │  │  │  │
│  │  │  │ (Telegraf)  │  │             │  │  • Topic detection          │  │  │  │
│  │  │  └──────┬──────┘  └──────┬──────┘  └──────────────┬──────────────┘  │  │  │
│  │  │         │                │                        │                 │  │  │
│  │  │         └────────────────┼────────────────────────┘                 │  │  │
│  │  │                          ▼                                          │  │  │
│  │  │  ┌─────────────────────────────────────────────────────────────┐    │  │  │
│  │  │  │                    BOT LOGIC LAYER                          │    │  │  │
│  │  │  └─────────────────────────────────────────────────────────────┘    │  │  │
│  │  │         │                │                        │                 │  │  │
│  │  │         ▼                ▼                        ▼                 │  │  │
│  │  │  ┌───────────┐    ┌───────────┐           ┌───────────────┐         │  │  │
│  │  │  │ Firecrawl │    │  SQLite   │           │ Sports Client │         │  │  │
│  │  │  │  Client   │    │ Database  │           │ (ESPN + Odds) │         │  │  │
│  │  │  └─────┬─────┘    └─────┬─────┘           └───────┬───────┘         │  │  │
│  │  └────────│────────────────│─────────────────────────│─────────────────┘  │  │
│  │           │                │                         │                    │  │
│  │  ┌────────▼────────┐ ┌─────▼─────┐                   │                    │  │
│  │  │  FIRECRAWL      │ │  REDIS    │                   │                    │  │
│  │  │  STACK          │ │  (Cache)  │◄──────────────────┘                    │  │
│  │  │  ┌───────────┐  │ │           │                                        │  │
│  │  │  │ API+Worker│  │ └───────────┘                                        │  │
│  │  │  │ Playwright│  │                                                      │  │
│  │  │  │ Redis     │  │                                                      │  │
│  │  │  └───────────┘  │                                                      │  │
│  │  └─────────────────┘                                                      │  │
│  │                                                                           │  │
│  │  ┌─────────────────────────────────────────────────────────────────────┐  │  │
│  │  │                    SPORTS DATA SERVICE                              │  │  │
│  │  │  ┌───────────────────────────────────────────────────────────────┐  │  │  │
│  │  │  │                    Node.js API Server                         │  │  │  │
│  │  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐    │  │  │  │
│  │  │  │  │ ESPN Client │  │  Odds API   │  │    Supabase         │    │  │  │  │
│  │  │  │  │             │  │   Client    │  │ (PostgreSQL + Auth) │    │  │  │  │
│  │  │  │  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘    │  │  │  │
│  │  │  │         │                │                    │               │  │  │  │
│  │  │  │         └────────────────┼────────────────────┘               │  │  │  │
│  │  │  │                          ▼                                    │  │  │  │
│  │  │  │  ┌─────────────────────────────────────────────────────────┐  │  │  │  │
│  │  │  │  │                   Redis Cache                           │  │  │  │  │
│  │  │  │  │  • ESPN data: 5 min TTL                                 │  │  │  │  │
│  │  │  │  │  • Odds data: 1 min TTL (changes frequently)            │  │  │  │  │
│  │  │  │  │  • Player images: 24 hour TTL                           │  │  │  │  │
│  │  │  │  └─────────────────────────────────────────────────────────┘  │  │  │  │
│  │  │  └───────────────────────────────────────────────────────────────┘  │  │  │
│  │  └─────────────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
                    │                    │                    │
                    ▼                    ▼                    ▼
            ┌───────────────┐    ┌───────────────┐    ┌───────────────┐
            │   Telegram    │    │   ESPN API    │    │ The Odds API  │
            │   Bot API     │    │  (Public)     │    │  (API Key)    │
            └───────────────┘    └───────────────┘    └───────────────┘
```

---

## 📦 Tech Stack

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| **Runtime** | Node.js | 20 LTS | JavaScript runtime |
| **Telegram SDK** | Telegraf | 4.x | Telegram Bot framework |
| **LLM Router** | OpenRouter API | Latest | Multi-model access |
| **Sports Data** | ESPN Public API | Latest | Scores, news, stats |
| **Betting Odds** | The Odds API | v4 | Sportsbook odds |
| **Web Scraper** | Firecrawl | Latest | General web scraping |
| **HTTP Client** | Axios | 1.x | API requests |
| **Bot Database** | SQLite3 | 3.x | Conversation persistence |
| **Sports Database** | Supabase | Latest (PostgreSQL 16.x) | Sports data storage, auth, realtime |
| **Database Client** | @supabase/supabase-js | Latest | Supabase SDK for database access |
| **Cache** | Redis | 7.x | API response caching |
| **Container** | Docker | 24.x+ | Containerization |
| **Orchestration** | Docker Compose | 2.x | Container management |

---

## 🏈 Sports Data Service - Standalone API App

### Database Schema (Supabase / PostgreSQL)

**Note:** This project uses self-hosted Supabase (PostgreSQL 16.x with built-in Auth, Storage, and Realtime). Tables should be created via Supabase migrations with Row Level Security (RLS) enabled.

```sql
-- Teams table
CREATE TABLE teams (
    id SERIAL PRIMARY KEY,
    espn_id VARCHAR(20) UNIQUE NOT NULL,
    sport VARCHAR(20) NOT NULL,
    league VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    abbreviation VARCHAR(10),
    location VARCHAR(100),
    logo_url TEXT,
    color VARCHAR(10),
    alternate_color VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Players table
CREATE TABLE players (
    id SERIAL PRIMARY KEY,
    espn_id VARCHAR(20) UNIQUE NOT NULL,
    team_id INTEGER REFERENCES teams(id),
    name VARCHAR(100) NOT NULL,
    position VARCHAR(20),
    jersey_number VARCHAR(5),
    height VARCHAR(10),
    weight VARCHAR(10),
    age INTEGER,
    headshot_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Games table
CREATE TABLE games (
    id SERIAL PRIMARY KEY,
    espn_id VARCHAR(20) UNIQUE NOT NULL,
    sport VARCHAR(20) NOT NULL,
    league VARCHAR(20) NOT NULL,
    home_team_id INTEGER REFERENCES teams(id),
    away_team_id INTEGER REFERENCES teams(id),
    home_score INTEGER,
    away_score INTEGER,
    status VARCHAR(50),
    period VARCHAR(20),
    clock VARCHAR(20),
    start_time TIMESTAMP,
    venue VARCHAR(200),
    broadcast VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Odds table
CREATE TABLE odds (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES games(id),
    sportsbook VARCHAR(50) NOT NULL,
    market_type VARCHAR(50) NOT NULL, -- h2h, spreads, totals
    home_odds DECIMAL(10,2),
    away_odds DECIMAL(10,2),
    home_spread DECIMAL(5,2),
    away_spread DECIMAL(5,2),
    total_over DECIMAL(5,2),
    total_under DECIMAL(5,2),
    last_update TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(game_id, sportsbook, market_type)
);

-- Player props table
CREATE TABLE player_props (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES games(id),
    player_id INTEGER REFERENCES players(id),
    sportsbook VARCHAR(50) NOT NULL,
    prop_type VARCHAR(50) NOT NULL, -- passing_yards, rushing_yards, etc
    line DECIMAL(10,2),
    over_odds DECIMAL(10,2),
    under_odds DECIMAL(10,2),
    last_update TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- News table  
CREATE TABLE news (
    id SERIAL PRIMARY KEY,
    espn_id VARCHAR(50) UNIQUE,
    sport VARCHAR(20) NOT NULL,
    headline TEXT NOT NULL,
    description TEXT,
    story_url TEXT,
    image_url TEXT,
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_games_sport ON games(sport);
CREATE INDEX idx_games_start_time ON games(start_time);
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_odds_game_id ON odds(game_id);
CREATE INDEX idx_player_props_game_id ON player_props(game_id);
CREATE INDEX idx_news_sport ON news(sport);
CREATE INDEX idx_news_published ON news(published_at);
```

### Caching Strategy (Redis)

| Data Type | TTL | Key Pattern | Reason |
|-----------|-----|-------------|--------|
| Live Scores | 30 seconds | `espn:scores:{sport}` | Changes during games |
| Game Odds | 1 minute | `odds:game:{gameId}` | Odds move frequently |
| Team Info | 24 hours | `espn:team:{teamId}` | Rarely changes |
| Player Info | 12 hours | `espn:player:{playerId}` | Occasionally updates |
| Player Images | 7 days | `espn:image:{playerId}` | Very stable |
| News | 5 minutes | `espn:news:{sport}` | Regular updates |
| Standings | 1 hour | `espn:standings:{sport}` | Updates after games |
| Prop Bets | 2 minutes | `odds:props:{gameId}` | Changes often |

### API Endpoints (Sports Data Service)

```
Sports Data Service - Port 3003
═══════════════════════════════════════════════════════════════

SCORES & GAMES
──────────────────────────────────────────────────────────────
GET  /api/scores/:sport              - Live scores by sport
GET  /api/scores/:sport/live         - Only in-progress games
GET  /api/games/:gameId              - Single game details
GET  /api/games/:sport/today         - Today's games
GET  /api/games/:sport/week          - This week's games

TEAMS
──────────────────────────────────────────────────────────────
GET  /api/teams/:sport               - All teams in league
GET  /api/teams/:teamId              - Team details
GET  /api/teams/:teamId/roster       - Team roster
GET  /api/teams/:teamId/schedule     - Team schedule

PLAYERS
──────────────────────────────────────────────────────────────
GET  /api/players/:playerId          - Player details
GET  /api/players/:playerId/stats    - Player statistics
GET  /api/players/:playerId/image    - Player headshot URL

NEWS
──────────────────────────────────────────────────────────────
GET  /api/news/:sport                - Latest news by sport
GET  /api/news/:sport/:teamId        - Team-specific news

STANDINGS
──────────────────────────────────────────────────────────────
GET  /api/standings/:sport           - Current standings

ODDS (The Odds API)
──────────────────────────────────────────────────────────────
GET  /api/odds/:sport                - All odds by sport
GET  /api/odds/game/:gameId          - Odds for specific game
GET  /api/odds/game/:gameId/props    - Player props for game
GET  /api/odds/best/:gameId          - Best odds comparison

SPORTSBOOKS
──────────────────────────────────────────────────────────────
GET  /api/sportsbooks                - Available sportsbooks
GET  /api/odds/book/:bookName/:sport - Odds from specific book

CACHE MANAGEMENT
──────────────────────────────────────────────────────────────
POST /api/cache/clear/:pattern       - Clear cache by pattern
GET  /api/cache/stats                - Cache statistics
```

---

## 🐳 Docker Installation Guide

### Prerequisites Checklist

- [ ] Ubuntu VPS (20.04 LTS or 22.04 LTS recommended)
- [ ] **Minimum 4GB RAM, 2 vCPU, 60GB storage** (PostgreSQL + Redis + Firecrawl)
- [ ] Root or sudo access
- [ ] Telegram Bot Token (from @BotFather)
- [ ] OpenRouter API Key (free at openrouter.ai)
- [ ] The Odds API Key (from the-odds-api.com)

---

### PHASE 1: Ubuntu Server Preparation

```bash
# Connect to your VPS
ssh root@your-server-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install essential tools
sudo apt install -y \
    curl wget git nano htop \
    ufw fail2ban unzip \
    ca-certificates gnupg lsb-release

# Configure firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Set timezone to CST
sudo timedatectl set-timezone America/Chicago

# Create non-root user
sudo adduser clawdbot
sudo usermod -aG sudo clawdbot
su - clawdbot
```

---

### PHASE 2: Docker Installation

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Post-installation
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker --version
docker run hello-world

# Enable on boot
sudo systemctl enable docker containerd

# Install Docker Compose
sudo apt install docker-compose-plugin -y
docker compose version
```

---

### PHASE 3: Sports Data Service Setup

#### Step 3.1: Create Project Directory

```bash
mkdir -p ~/clawd-sports-api
cd ~/clawd-sports-api
mkdir -p src data
```

#### Step 3.2: Create Package.json

```bash
cat << 'EOF' > package.json
{
  "name": "clawd-sports-api",
  "version": "1.0.0",
  "description": "Sports Data Service with ESPN API and The Odds API",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "node --watch src/server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "axios": "^1.6.0",
    "@supabase/supabase-js": "^2.39.0",
    "redis": "^4.6.0",
    "dotenv": "^16.3.0",
    "winston": "^3.11.0",
    "node-cron": "^3.0.3"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
EOF
```

#### Step 3.3: Create Environment File

```bash
cat << 'EOF' > .env.example
# ===========================================
# SPORTS DATA SERVICE CONFIGURATION
# ===========================================

# Server
PORT=3003
NODE_ENV=production

# The Odds API
ODDS_API_KEY=your_odds_api_key_here
ODDS_API_BASE_URL=https://api.the-odds-api.com/v4

# ESPN API (Public - No key required)
ESPN_API_BASE_URL=https://site.api.espn.com/apis/site/v2

# Supabase (Self-Hosted)
SUPABASE_URL=https://your-supabase-url.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
SUPABASE_ANON_KEY=your_anon_key_here

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# Cache TTLs (in seconds)
CACHE_TTL_SCORES=30
CACHE_TTL_ODDS=60
CACHE_TTL_NEWS=300
CACHE_TTL_STANDINGS=3600
CACHE_TTL_TEAMS=86400
CACHE_TTL_PLAYERS=43200
CACHE_TTL_IMAGES=604800

# Logging
LOG_LEVEL=info
EOF

cp .env.example .env
nano .env  # Add your API key
```

#### Step 3.4: Create ESPN Client

```bash
cat << 'EOF' > src/espn-client.js
const axios = require('axios');
const logger = require('./logger');

class ESPNClient {
  constructor() {
    this.baseUrl = process.env.ESPN_API_BASE_URL || 'https://site.api.espn.com/apis/site/v2';
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
    });
  }

  // Sport mappings
  getSportPath(sport) {
    const sportPaths = {
      nfl: 'football/nfl',
      nba: 'basketball/nba',
      mlb: 'baseball/mlb',
      nhl: 'hockey/nhl',
      ncaaf: 'football/college-football',
      ncaab: 'basketball/mens-college-basketball',
    };
    return sportPaths[sport.toLowerCase()] || sport;
  }

  async getScoreboard(sport) {
    try {
      const path = this.getSportPath(sport);
      const response = await this.client.get(`/sports/${path}/scoreboard`);
      return this.parseScoreboard(response.data, sport);
    } catch (error) {
      logger.error(`ESPN scoreboard error for ${sport}: ${error.message}`);
      throw error;
    }
  }

  parseScoreboard(data, sport) {
    const events = data.events || [];
    return events.map(event => ({
      id: event.id,
      sport: sport,
      name: event.name,
      shortName: event.shortName,
      date: event.date,
      status: {
        type: event.status?.type?.name,
        state: event.status?.type?.state,
        detail: event.status?.type?.detail,
        period: event.status?.period,
        clock: event.status?.displayClock,
      },
      homeTeam: this.parseTeam(event.competitions?.[0]?.competitors?.find(c => c.homeAway === 'home')),
      awayTeam: this.parseTeam(event.competitions?.[0]?.competitors?.find(c => c.homeAway === 'away')),
      venue: event.competitions?.[0]?.venue?.fullName,
      broadcast: event.competitions?.[0]?.broadcasts?.[0]?.names?.join(', '),
      odds: event.competitions?.[0]?.odds?.[0],
    }));
  }

  parseTeam(competitor) {
    if (!competitor) return null;
    return {
      id: competitor.team?.id,
      name: competitor.team?.displayName,
      abbreviation: competitor.team?.abbreviation,
      logo: competitor.team?.logo,
      score: competitor.score,
      record: competitor.records?.[0]?.summary,
      winner: competitor.winner,
    };
  }

  async getTeam(teamId, sport) {
    try {
      const path = this.getSportPath(sport);
      const response = await this.client.get(`/sports/${path}/teams/${teamId}`);
      return response.data.team;
    } catch (error) {
      logger.error(`ESPN team error: ${error.message}`);
      throw error;
    }
  }

  async getPlayer(playerId, sport) {
    try {
      const path = this.getSportPath(sport);
      const response = await this.client.get(`/sports/${path}/athletes/${playerId}`);
      return {
        id: response.data.athlete?.id,
        name: response.data.athlete?.displayName,
        position: response.data.athlete?.position?.abbreviation,
        team: response.data.athlete?.team?.displayName,
        headshot: response.data.athlete?.headshot?.href,
        jersey: response.data.athlete?.jersey,
        height: response.data.athlete?.height,
        weight: response.data.athlete?.weight,
        age: response.data.athlete?.age,
        birthPlace: response.data.athlete?.birthPlace?.city,
      };
    } catch (error) {
      logger.error(`ESPN player error: ${error.message}`);
      throw error;
    }
  }

  async getNews(sport, limit = 10) {
    try {
      const path = this.getSportPath(sport);
      const response = await this.client.get(`/sports/${path}/news`, {
        params: { limit }
      });
      return (response.data.articles || []).map(article => ({
        id: article.dataSourceIdentifier,
        headline: article.headline,
        description: article.description,
        published: article.published,
        images: article.images?.[0]?.url,
        link: article.links?.web?.href,
      }));
    } catch (error) {
      logger.error(`ESPN news error: ${error.message}`);
      throw error;
    }
  }

  async getStandings(sport) {
    try {
      const path = this.getSportPath(sport);
      const response = await this.client.get(`/sports/${path}/standings`);
      return response.data;
    } catch (error) {
      logger.error(`ESPN standings error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new ESPNClient();
EOF
```

#### Step 3.5: Create Odds API Client

```bash
cat << 'EOF' > src/odds-client.js
const axios = require('axios');
const logger = require('./logger');

class OddsClient {
  constructor() {
    this.baseUrl = process.env.ODDS_API_BASE_URL || 'https://api.the-odds-api.com/v4';
    this.apiKey = process.env.ODDS_API_KEY;
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
      params: {
        apiKey: this.apiKey,
      },
    });

    // Track API usage
    this.remainingRequests = null;
    this.usedRequests = null;
  }

  // Sport key mappings
  getSportKey(sport) {
    const sportKeys = {
      nfl: 'americanfootball_nfl',
      nba: 'basketball_nba',
      mlb: 'baseball_mlb',
      nhl: 'icehockey_nhl',
      ncaaf: 'americanfootball_ncaaf',
      ncaab: 'basketball_ncaab',
    };
    return sportKeys[sport.toLowerCase()] || sport;
  }

  updateRateLimits(headers) {
    this.remainingRequests = headers['x-requests-remaining'];
    this.usedRequests = headers['x-requests-used'];
    logger.debug(`Odds API: ${this.remainingRequests} requests remaining`);
  }

  async getSports() {
    try {
      const response = await this.client.get('/sports');
      this.updateRateLimits(response.headers);
      return response.data;
    } catch (error) {
      logger.error(`Odds API sports error: ${error.message}`);
      throw error;
    }
  }

  async getOdds(sport, markets = 'h2h,spreads,totals', bookmakers = 'fanduel,draftkings') {
    try {
      const sportKey = this.getSportKey(sport);
      const response = await this.client.get(`/sports/${sportKey}/odds`, {
        params: {
          regions: 'us',
          markets: markets,
          bookmakers: bookmakers,
          oddsFormat: 'american',
        },
      });
      this.updateRateLimits(response.headers);
      return this.parseOdds(response.data);
    } catch (error) {
      logger.error(`Odds API odds error for ${sport}: ${error.message}`);
      throw error;
    }
  }

  parseOdds(data) {
    return data.map(event => ({
      id: event.id,
      sport: event.sport_key,
      homeTeam: event.home_team,
      awayTeam: event.away_team,
      startTime: event.commence_time,
      bookmakers: event.bookmakers?.map(book => ({
        name: book.key,
        title: book.title,
        lastUpdate: book.last_update,
        markets: book.markets?.map(market => ({
          type: market.key,
          outcomes: market.outcomes?.map(outcome => ({
            name: outcome.name,
            price: outcome.price,
            point: outcome.point,
          })),
        })),
      })),
    }));
  }

  async getEventOdds(eventId, sport) {
    try {
      const sportKey = this.getSportKey(sport);
      const response = await this.client.get(`/sports/${sportKey}/events/${eventId}/odds`, {
        params: {
          regions: 'us',
          markets: 'h2h,spreads,totals,player_pass_yds,player_rush_yds,player_reception_yds',
          oddsFormat: 'american',
        },
      });
      this.updateRateLimits(response.headers);
      return response.data;
    } catch (error) {
      logger.error(`Odds API event odds error: ${error.message}`);
      throw error;
    }
  }

  async getScores(sport, daysFrom = 1) {
    try {
      const sportKey = this.getSportKey(sport);
      const response = await this.client.get(`/sports/${sportKey}/scores`, {
        params: {
          daysFrom: daysFrom,
        },
      });
      this.updateRateLimits(response.headers);
      return response.data;
    } catch (error) {
      logger.error(`Odds API scores error for ${sport}: ${error.message}`);
      throw error;
    }
  }

  getBestOdds(oddsData, market = 'h2h') {
    const bestOdds = { home: null, away: null };
    
    for (const event of oddsData) {
      for (const bookmaker of event.bookmakers || []) {
        const marketData = bookmaker.markets?.find(m => m.key === market);
        if (marketData) {
          for (const outcome of marketData.outcomes || []) {
            if (outcome.name === event.homeTeam) {
              if (!bestOdds.home || outcome.price > bestOdds.home.price) {
                bestOdds.home = { ...outcome, bookmaker: bookmaker.title };
              }
            } else {
              if (!bestOdds.away || outcome.price > bestOdds.away.price) {
                bestOdds.away = { ...outcome, bookmaker: bookmaker.title };
              }
            }
          }
        }
      }
    }
    
    return bestOdds;
  }

  getRemainingRequests() {
    return {
      remaining: this.remainingRequests,
      used: this.usedRequests,
    };
  }
}

module.exports = new OddsClient();
EOF
```

#### Step 3.6: Create Cache Manager

```bash
cat << 'EOF' > src/cache.js
const { createClient } = require('redis');
const logger = require('./logger');

class CacheManager {
  constructor() {
    this.client = null;
    this.connected = false;
    this.ttls = {
      scores: parseInt(process.env.CACHE_TTL_SCORES) || 30,
      odds: parseInt(process.env.CACHE_TTL_ODDS) || 60,
      news: parseInt(process.env.CACHE_TTL_NEWS) || 300,
      standings: parseInt(process.env.CACHE_TTL_STANDINGS) || 3600,
      teams: parseInt(process.env.CACHE_TTL_TEAMS) || 86400,
      players: parseInt(process.env.CACHE_TTL_PLAYERS) || 43200,
      images: parseInt(process.env.CACHE_TTL_IMAGES) || 604800,
    };
  }

  async connect() {
    try {
      this.client = createClient({
        socket: {
          host: process.env.REDIS_HOST || 'redis',
          port: parseInt(process.env.REDIS_PORT) || 6379,
        },
      });

      this.client.on('error', (err) => logger.error(`Redis error: ${err.message}`));
      this.client.on('connect', () => logger.info('Redis connected'));
      
      await this.client.connect();
      this.connected = true;
    } catch (error) {
      logger.error(`Redis connection failed: ${error.message}`);
      this.connected = false;
    }
  }

  async get(key) {
    if (!this.connected) return null;
    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error(`Cache get error: ${error.message}`);
      return null;
    }
  }

  async set(key, value, ttlType = 'scores') {
    if (!this.connected) return false;
    try {
      const ttl = this.ttls[ttlType] || 60;
      await this.client.setEx(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      logger.error(`Cache set error: ${error.message}`);
      return false;
    }
  }

  async delete(pattern) {
    if (!this.connected) return false;
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
      return true;
    } catch (error) {
      logger.error(`Cache delete error: ${error.message}`);
      return false;
    }
  }

  async getStats() {
    if (!this.connected) return null;
    try {
      const info = await this.client.info('stats');
      return info;
    } catch (error) {
      return null;
    }
  }
}

module.exports = new CacheManager();
EOF
```

#### Step 3.7: Create Database Manager

```bash
cat << 'EOF' > src/database.js
const { createClient } = require('@supabase/supabase-js');
const logger = require('./logger');

// Initialize Supabase client with service role key (bypasses RLS)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Note: Tables should be created via Supabase migrations
// Enable Row Level Security (RLS) on all tables
// Use service_role_key for admin operations

module.exports = {
  supabase,
  
  async saveTeam(team, sport) {
    const query = `
      INSERT INTO teams (espn_id, sport, name, abbreviation, logo_url)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (espn_id) DO UPDATE SET
        name = EXCLUDED.name,
        abbreviation = EXCLUDED.abbreviation,
        logo_url = EXCLUDED.logo_url,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    const result = await pool.query(query, [team.id, sport, team.name, team.abbreviation, team.logo]);
    return result.rows[0];
  },

  async saveGame(game) {
    const query = `
      INSERT INTO games (espn_id, sport, home_team_espn_id, away_team_espn_id, home_score, away_score, status, start_time)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (espn_id) DO UPDATE SET
        home_score = EXCLUDED.home_score,
        away_score = EXCLUDED.away_score,
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    const result = await pool.query(query, [
      game.id, game.sport, game.homeTeam?.id, game.awayTeam?.id,
      game.homeTeam?.score, game.awayTeam?.score, game.status?.type, game.date
    ]);
    return result.rows[0];
  },

  async saveOdds(gameId, sportsbook, marketType, odds) {
    const query = `
      INSERT INTO odds_history (game_espn_id, sportsbook, market_type, home_odds, away_odds, spread, total)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
    await pool.query(query, [gameId, sportsbook, marketType, odds.home, odds.away, odds.spread, odds.total]);
  },

  async saveNews(article, sport) {
    const query = `
      INSERT INTO news (espn_id, sport, headline, description, image_url, link, published_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (espn_id) DO NOTHING
    `;
    await pool.query(query, [
      article.id, sport, article.headline, article.description,
      article.images, article.link, article.published
    ]);
  },

  async getRecentGames(sport, limit = 20) {
    const query = `SELECT * FROM games WHERE sport = $1 ORDER BY start_time DESC LIMIT $2`;
    const result = await pool.query(query, [sport, limit]);
    return result.rows;
  },

  async getOddsHistory(gameId) {
    const query = `SELECT * FROM odds_history WHERE game_espn_id = $1 ORDER BY recorded_at DESC`;
    const result = await pool.query(query, [gameId]);
    return result.rows;
  },
};
EOF
```

#### Step 3.8: Create Logger

```bash
cat << 'EOF' > src/logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: '/app/logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: '/app/logs/combined.log' }),
  ],
});

module.exports = logger;
EOF
```

#### Step 3.9: Create API Server

```bash
cat << 'EOF' > src/server.js
require('dotenv').config();

const express = require('express');
const cron = require('node-cron');
const logger = require('./logger');
const cache = require('./cache');
const db = require('./database');
const espn = require('./espn-client');
const odds = require('./odds-client');

const app = express();
const PORT = process.env.PORT || 3003;

app.use(express.json());

// Middleware to log requests
app.use((req, res, next) => {
  logger.debug(`${req.method} ${req.path}`);
  next();
});

// ============ SCORES ============

app.get('/api/scores/:sport', async (req, res) => {
  try {
    const { sport } = req.params;
    const cacheKey = `espn:scores:${sport}`;
    
    // Check cache
    let data = await cache.get(cacheKey);
    if (data) {
      return res.json({ source: 'cache', data });
    }
    
    // Fetch fresh
    data = await espn.getScoreboard(sport);
    await cache.set(cacheKey, data, 'scores');
    
    // Save to database
    for (const game of data) {
      await db.saveGame(game);
    }
    
    res.json({ source: 'api', data });
  } catch (error) {
    logger.error(`Scores error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/scores/:sport/live', async (req, res) => {
  try {
    const { sport } = req.params;
    const data = await espn.getScoreboard(sport);
    const liveGames = data.filter(g => g.status?.state === 'in');
    res.json(liveGames);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ NEWS ============

app.get('/api/news/:sport', async (req, res) => {
  try {
    const { sport } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    const cacheKey = `espn:news:${sport}`;
    
    let data = await cache.get(cacheKey);
    if (data) {
      return res.json({ source: 'cache', data });
    }
    
    data = await espn.getNews(sport, limit);
    await cache.set(cacheKey, data, 'news');
    
    // Save to database
    for (const article of data) {
      await db.saveNews(article, sport);
    }
    
    res.json({ source: 'api', data });
  } catch (error) {
    logger.error(`News error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ============ TEAMS ============

app.get('/api/teams/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params;
    const { sport } = req.query;
    const cacheKey = `espn:team:${teamId}`;
    
    let data = await cache.get(cacheKey);
    if (data) {
      return res.json({ source: 'cache', data });
    }
    
    data = await espn.getTeam(teamId, sport || 'nfl');
    await cache.set(cacheKey, data, 'teams');
    
    res.json({ source: 'api', data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ PLAYERS ============

app.get('/api/players/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params;
    const { sport } = req.query;
    const cacheKey = `espn:player:${playerId}`;
    
    let data = await cache.get(cacheKey);
    if (data) {
      return res.json({ source: 'cache', data });
    }
    
    data = await espn.getPlayer(playerId, sport || 'nfl');
    await cache.set(cacheKey, data, 'players');
    
    res.json({ source: 'api', data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/players/:playerId/image', async (req, res) => {
  try {
    const { playerId } = req.params;
    const { sport } = req.query;
    const cacheKey = `espn:image:${playerId}`;
    
    let imageUrl = await cache.get(cacheKey);
    if (imageUrl) {
      return res.json({ source: 'cache', imageUrl });
    }
    
    const player = await espn.getPlayer(playerId, sport || 'nfl');
    imageUrl = player.headshot;
    await cache.set(cacheKey, imageUrl, 'images');
    
    res.json({ source: 'api', imageUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ STANDINGS ============

app.get('/api/standings/:sport', async (req, res) => {
  try {
    const { sport } = req.params;
    const cacheKey = `espn:standings:${sport}`;
    
    let data = await cache.get(cacheKey);
    if (data) {
      return res.json({ source: 'cache', data });
    }
    
    data = await espn.getStandings(sport);
    await cache.set(cacheKey, data, 'standings');
    
    res.json({ source: 'api', data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ ODDS ============

app.get('/api/odds/:sport', async (req, res) => {
  try {
    const { sport } = req.params;
    const cacheKey = `odds:${sport}`;
    
    let data = await cache.get(cacheKey);
    if (data) {
      return res.json({ source: 'cache', data, apiUsage: odds.getRemainingRequests() });
    }
    
    data = await odds.getOdds(sport);
    await cache.set(cacheKey, data, 'odds');
    
    res.json({ source: 'api', data, apiUsage: odds.getRemainingRequests() });
  } catch (error) {
    logger.error(`Odds error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/odds/game/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { sport } = req.query;
    const cacheKey = `odds:game:${gameId}`;
    
    let data = await cache.get(cacheKey);
    if (data) {
      return res.json({ source: 'cache', data });
    }
    
    data = await odds.getEventOdds(gameId, sport || 'nfl');
    await cache.set(cacheKey, data, 'odds');
    
    res.json({ source: 'api', data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/odds/best/:sport', async (req, res) => {
  try {
    const { sport } = req.params;
    const oddsData = await odds.getOdds(sport);
    const bestOdds = odds.getBestOdds(oddsData);
    res.json(bestOdds);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ SPORTSBOOKS ============

app.get('/api/sportsbooks', async (req, res) => {
  res.json({
    available: [
      'fanduel', 'draftkings', 'betmgm', 'caesars', 
      'pointsbet', 'barstool', 'wynn', 'betrivers'
    ]
  });
});

// ============ CACHE MANAGEMENT ============

app.post('/api/cache/clear/:pattern', async (req, res) => {
  try {
    const { pattern } = req.params;
    await cache.delete(`*${pattern}*`);
    res.json({ success: true, pattern });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/cache/stats', async (req, res) => {
  try {
    const stats = await cache.getStats();
    res.json({ stats, oddsApiUsage: odds.getRemainingRequests() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ HEALTH CHECK ============

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============ SCHEDULED JOBS ============

// Refresh scores every minute during peak hours
cron.schedule('* 14-23 * * *', async () => {
  logger.info('Scheduled: Refreshing sports scores...');
  const sports = ['nfl', 'nba', 'mlb', 'nhl'];
  for (const sport of sports) {
    try {
      const data = await espn.getScoreboard(sport);
      await cache.set(`espn:scores:${sport}`, data, 'scores');
    } catch (error) {
      logger.error(`Scheduled refresh error for ${sport}: ${error.message}`);
    }
  }
});

// Refresh odds every 5 minutes
cron.schedule('*/5 14-23 * * *', async () => {
  logger.info('Scheduled: Refreshing odds...');
  const sports = ['nfl', 'nba'];
  for (const sport of sports) {
    try {
      const data = await odds.getOdds(sport);
      await cache.set(`odds:${sport}`, data, 'odds');
    } catch (error) {
      logger.error(`Scheduled odds refresh error: ${error.message}`);
    }
  }
});

// ============ STARTUP ============

async function start() {
  try {
    await cache.connect();
    await db.initDatabase();
    
    app.listen(PORT, () => {
      logger.info(`🏈 Sports Data Service running on port ${PORT}`);
      logger.info(`📊 ESPN API: Ready`);
      logger.info(`🎰 The Odds API: Ready`);
      logger.info(`💾 PostgreSQL: Connected`);
      logger.info(`⚡ Redis Cache: Connected`);
    });
  } catch (error) {
    logger.error(`Startup failed: ${error.message}`);
    process.exit(1);
  }
}

start();
EOF
```

#### Step 3.10: Create Dockerfile

```bash
cat << 'EOF' > Dockerfile
FROM node:20-alpine

WORKDIR /app

RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY src/ ./src/

RUN mkdir -p /app/logs && chown -R appuser:appgroup /app

USER appuser

EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3003/health || exit 1

CMD ["node", "src/server.js"]
EOF
```

#### Step 3.11: Create Docker Compose

```bash
cat << 'EOF' > docker-compose.yml
version: '3.8'

services:
  sports-api:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: clawd-sports-api
    restart: unless-stopped
    ports:
      - "3003:3003"
    env_file:
      - .env
    volumes:
      - ./logs:/app/logs
    depends_on:
      redis:
        condition: service_healthy
    networks:
      - clawd-network
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M

  redis:
    image: redis:7-alpine
    container_name: clawd-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis-data:/data
    networks:
      - clawd-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits:
          cpus: '0.25'
          memory: 300M

networks:
  clawd-network:
    driver: bridge

volumes:
  redis-data:
EOF
```

**Note:** Supabase runs on your self-hosted Ubuntu VPS (sean-ubuntu-vps). See `../sean-ubuntu/SEANUBUNTU.md` for SSH connection details.

---

### PHASE 4: Firecrawl Setup (General Web Scraping)

Firecrawl is now used for **general web scraping** during your daily schedule, not for sports data.

```bash
# Create Firecrawl directory
mkdir -p ~/firecrawl
cd ~/firecrawl

# Clone Firecrawl
git clone https://github.com/mendableai/firecrawl.git .

# Create docker-compose.yml (simplified for general use)
cat << 'EOF' > docker-compose.override.yml
version: '3.8'

services:
  firecrawl-api:
    ports:
      - "3002:3002"
    networks:
      - clawd-network

  redis:
    networks:
      - clawd-network

networks:
  clawd-network:
    external: true
    name: clawd-sports-api_clawd-network
EOF

# Start Firecrawl
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d
```

---

### PHASE 5: Clawd Bot Setup (Updated)

Update the Clawd Bot to use the Sports Data Service instead of Firecrawl for sports:

```bash
mkdir -p ~/clawd-bot
cd ~/clawd-bot

# Create updated sports client for the bot
cat << 'EOF' > src/sports-client.js
const axios = require('axios');
const logger = require('./logger');

class SportsClient {
  constructor() {
    this.baseUrl = process.env.SPORTS_API_URL || 'http://clawd-sports-api:3003';
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 15000,
    });
  }

  async getScores(sport) {
    try {
      const response = await this.client.get(`/api/scores/${sport}`);
      return response.data;
    } catch (error) {
      logger.error(`Sports API scores error: ${error.message}`);
      throw error;
    }
  }

  async getLiveScores(sport) {
    try {
      const response = await this.client.get(`/api/scores/${sport}/live`);
      return response.data;
    } catch (error) {
      logger.error(`Sports API live scores error: ${error.message}`);
      throw error;
    }
  }

  async getNews(sport, limit = 5) {
    try {
      const response = await this.client.get(`/api/news/${sport}`, { params: { limit } });
      return response.data;
    } catch (error) {
      logger.error(`Sports API news error: ${error.message}`);
      throw error;
    }
  }

  async getOdds(sport) {
    try {
      const response = await this.client.get(`/api/odds/${sport}`);
      return response.data;
    } catch (error) {
      logger.error(`Sports API odds error: ${error.message}`);
      throw error;
    }
  }

  async getPlayerImage(playerId, sport = 'nfl') {
    try {
      const response = await this.client.get(`/api/players/${playerId}/image`, {
        params: { sport }
      });
      return response.data.imageUrl;
    } catch (error) {
      logger.error(`Sports API player image error: ${error.message}`);
      return null;
    }
  }

  async getStandings(sport) {
    try {
      const response = await this.client.get(`/api/standings/${sport}`);
      return response.data;
    } catch (error) {
      logger.error(`Sports API standings error: ${error.message}`);
      throw error;
    }
  }

  formatScoresForBot(scoresData) {
    const games = scoresData.data || scoresData;
    if (!games || games.length === 0) return 'No games found.';

    return games.map(game => {
      const status = game.status?.detail || game.status?.type || 'Scheduled';
      const home = game.homeTeam;
      const away = game.awayTeam;
      
      return `🏈 ${away?.abbreviation || away?.name} ${away?.score || '-'} @ ${home?.abbreviation || home?.name} ${home?.score || '-'}\n   📍 ${status}`;
    }).join('\n\n');
  }

  formatOddsForBot(oddsData) {
    const events = oddsData.data || oddsData;
    if (!events || events.length === 0) return 'No odds available.';

    return events.slice(0, 5).map(event => {
      const fanduel = event.bookmakers?.find(b => b.name === 'fanduel');
      const h2h = fanduel?.markets?.find(m => m.type === 'h2h');
      
      if (!h2h) return null;
      
      const homeOdds = h2h.outcomes?.find(o => o.name === event.homeTeam)?.price;
      const awayOdds = h2h.outcomes?.find(o => o.name === event.awayTeam)?.price;
      
      return `💰 ${event.awayTeam} (${awayOdds > 0 ? '+' : ''}${awayOdds}) @ ${event.homeTeam} (${homeOdds > 0 ? '+' : ''}${homeOdds})`;
    }).filter(Boolean).join('\n');
  }
}

module.exports = new SportsClient();
EOF
```

Update `.env` to include Sports API:

```bash
# Add to .env
SPORTS_API_URL=http://clawd-sports-api:3003
```

Update `docker-compose.yml` to connect to sports network:

```bash
cat << 'EOF' > docker-compose.yml
version: '3.8'

services:
  clawd-bot:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: clawd-bot
    restart: unless-stopped
    env_file:
      - .env
    environment:
      - TZ=America/Chicago
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    networks:
      - clawd-sports-api_clawd-network
    depends_on:
      - clawd-sports-api
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M

networks:
  clawd-sports-api_clawd-network:
    external: true
EOF
```

---

### PHASE 6: Deploy Everything

```bash
# 1. Start Sports Data Service first
cd ~/clawd-sports-api
cp .env.example .env
nano .env  # Add ODDS_API_KEY and POSTGRES_PASSWORD
docker compose up -d --build

# 2. Verify Sports API is running
curl http://localhost:3003/health
curl http://localhost:3003/api/scores/nfl

# 3. Start Firecrawl (optional, for general scraping)
cd ~/firecrawl
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d

# 4. Start Clawd Bot
cd ~/clawd-bot
cp .env.example .env
nano .env  # Add TELEGRAM_BOT_TOKEN, OPENROUTER_API_KEY
docker compose up -d --build

# 5. Check all containers
docker ps
```

---

## 📱 Bot Commands Reference

| Command | Description | Data Source |
|---------|-------------|-------------|
| `/start` | Welcome message | - |
| `/help` | All commands | - |
| `/mode` | Current mode & model | - |
| `/schedule` | View daily schedule | - |
| `/trading` | Switch to trading mode | Firecrawl (optional) |
| `/fitness` | Switch to fitness mode | - |
| `/productivity` | Switch to productivity mode | Firecrawl (optional) |
| `/sports` | Switch to sports mode | ESPN + Odds API |
| `/auto` | Return to auto-switching | - |
| `/scores` | Live sports scores | ESPN API |
| `/nfl` | NFL scores | ESPN API |
| `/nba` | NBA scores | ESPN API |
| `/mlb` | MLB scores | ESPN API |
| `/odds` | Betting odds | The Odds API |
| `/news` | Sports news | ESPN API |
| `/standings` | League standings | ESPN API |
| `/clear` | Clear history | - |

---

## 🎰 Sports Betting Features

| Feature | Command/Keyword | Sportsbooks |
|---------|-----------------|-------------|
| Moneyline Odds | `/odds nfl` | FanDuel, DraftKings |
| Spread Odds | "spread", "line" | FanDuel, DraftKings |
| Over/Under | "total", "over under" | FanDuel, DraftKings |
| Best Odds | `/odds best` | All available |
| Player Props | "props", "passing yards" | Coming soon |

---

## 🔐 Security & API Keys

| Service | Key Required | Where to Get |
|---------|--------------|--------------|
| Telegram | Yes | @BotFather |
| OpenRouter | Yes | openrouter.ai/keys |
| ESPN API | No | Public API |
| The Odds API | Yes | the-odds-api.com |

---

## 📊 API Rate Limits

| API | Free Tier Limit | Our Usage |
|-----|-----------------|-----------|
| OpenRouter | ~20 req/min | LLM calls only |
| ESPN API | No limit (public) | Cached 30s-24h |
| The Odds API | 500 req/month | Cached 1-5 min |

---

## 🚀 Quick Start Summary

```bash
# 1. Clone/create all projects
mkdir -p ~/clawd-{sports-api,bot}

# 2. Deploy Sports Data Service
cd ~/clawd-sports-api
# Create files from above
docker compose up -d --build

# 3. Deploy Clawd Bot  
cd ~/clawd-bot
# Create files from above
docker compose up -d --build

# 4. Test
curl http://localhost:3003/api/scores/nfl
docker logs clawd-bot -f
```

---

---

## 🔧 IMPROVEMENTS & ENHANCEMENTS (2026-01-17)

This section documents recommended improvements based on comprehensive architecture, security, and feature analysis.

**Note:** This project uses **self-hosted Supabase** (PostgreSQL 16.x with built-in connection pooling, Auth, and Realtime) instead of standalone PostgreSQL. Adjust recommendations accordingly.

### Architecture & Scalability Improvements

#### HIGH PRIORITY

**1. Database Optimization (Supabase)**
- Add composite indexes for common query patterns (sport + status, sport + date)
- Implement partial indexes for live games filtering
- Add covering index for odds queries
- **Note:** Supabase includes built-in PgBouncer connection pooling - no additional setup needed
- Use Supabase's migration system for schema changes
- Enable Row Level Security (RLS) policies for data access control

**2. Caching Strategy Enhancements**
- Implement Cache-Aside pattern with Stale-While-Revalidate
- Add background cache refresh to prevent thundering herd
- Implement token bucket rate limiting for external APIs
- Consider Redis Cluster for horizontal scaling (when needed)

**3. Resilience & Reliability**
- Implement Circuit Breaker pattern for external API calls
- Add deep health checks with dependency validation
- Implement automated backups with WAL archiving
- Add graceful shutdown handlers

**4. Monitoring & Observability**
- Deploy Prometheus + Grafana for metrics and dashboards
- Add Loki for log aggregation
- Implement cAdvisor for container monitoring
- Add custom application metrics (request duration, cache hit rates, API usage)

**5. Code Quality**
- Implement layered architecture (controllers, services, repositories)
- Add comprehensive input validation using Joi
- Implement centralized error handling
- Add comprehensive testing strategy (see below)

---

## Testing Strategy

### Testing Pyramid
```
        E2E Tests (5%)
       ┌───────────────┐
      │               │
     │   Integration  │  (20%)
    │      Tests      │
   │                  │
  │    Unit Tests     │  (75%)
 │                    │
└──────────────────────┘
```

### Unit Tests (75% of tests)
**Purpose**: Test functions and classes in isolation

**What to test**:
- Service layer business logic
- Repository data transformations
- Controller request/response handling
- Utility functions
- Error handling

**Tools**: Node.js native test runner (`node:test`)

**Example**:
```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { normalizeGameData } from '../src/clients/espn-client.js';

describe('normalizeGameData', () => {
  it('should extract home and away teams from ESPN event', () => {
    const espnEvent = { /* ... */ };
    const result = normalizeGameData(espnEvent, 'nfl');
    assert.equal(result.homeTeam.name, 'Kansas City Chiefs');
    assert.equal(result.awayTeam.name, 'Houston Texans');
  });
});
```

### Integration Tests (20% of tests)
**Purpose**: Test how components work together

**What to test**:
- API endpoints with real database
- Cache + database interactions
- External API + Supabase write operations
- Complete request flows

**Tools**: Node.js test runner + test database

**Example**:
```javascript
describe('GET /api/scores/nfl', () => {
  it('should return cached scores when available', async () => {
    await redis.set('scores:nfl', JSON.stringify(mockScores));
    const response = await fetch('http://localhost:3003/api/scores/nfl');
    assert.equal(await response.json().games[0].homeTeam.name, 'Chiefs');
  });
});
```

### E2E Tests (5% of tests)
**Purpose**: Test complete user workflows

**What to test**:
- Bot command flows
- Multi-service interactions
- Production-like environment

**Tools**: Playwright or custom test runners

### Test Coverage Requirements

| Component | Target | Tool |
|-----------|--------|------|
| Sports API Service | 85% | c8 |
| Clawd Bot | 80% | c8 |
| Firecrawl Service | 75% | c8 |

### CI/CD Testing Pipeline

```yaml
# GitHub Actions example
test:
  - npm run test:ci
  - npm run test:integration
  - Upload coverage to Codecov
  - Fail if coverage < threshold
```

### Test Data Management

**Test Database**:
- Separate Supabase project or schema
- Seed with known test data before each run
- Clean up after tests complete

**Mock Data**:
- Use factory functions for consistent test data
- Store fixtures in `tests/fixtures/` directory

### Security Improvements

#### CRITICAL PRIORITY

**1. Secret Management**
- Implement Docker secrets or external vault (HashiCorp Vault, AWS Secrets Manager)
- Use multi-stage builds to avoid secrets in container images
- Add API key validation at startup
- Implement secret rotation strategy

**2. Data Encryption**
- **Supabase:** Built-in encryption for data at rest
- Use SQLCipher for encrypted SQLite
- Enable TLS for Redis connections
- Encrypt conversation history in database
- Encrypt all backups
- **Note:** Supabase requires TLS for all connections

**3. Access Control**
- Implement user authorization/whitelist
- Add rate limiting per user
- Protect dangerous commands with confirmation
- Implement user blocklist for abuse

**4. Input Validation & Sanitization**
- Validate all user inputs with Joi schemas
- Sanitize bot messages to prevent prompt injection
- Use parameterized queries exclusively (prevent SQL injection)
- Add API response schema validation

**5. Network Security**
- Implement network segmentation (frontend, backend, database networks)
- Use internal networking only (expose via reverse proxy)
- Configure UFW firewall strictly
- Enable Redis authentication and ACL

**6. Container Security**
- Run containers as non-root user
- Add Docker security scanning to CI/CD (Trivy)
- Set resource limits on all containers
- Never mount docker.sock

### Feature Enhancements

#### USER EXPERIENCE

**1. Smart Onboarding (Should)**
- Progressive onboarding collecting user preferences
- Ask for favorite teams/leagues
- Set preferred sports for updates
- Choose default mode preference

**2. Rich Formatting (Should)**
- Use Telegram formatting (bold, emoji indicators)
- Tables for standings and odds comparison
- Inline buttons for quick actions
- Visual game status indicators (🔴 Live, ⏰ Upcoming, ✅ Final)

**3. Contextual Error Messages (Should)**
- Helpful error messages with suggested alternatives
- "No live games right now. Next [team] game is [date] at [time]"
- "Odds API limit reached. Try again in 10 minutes"

**4. User Profiles (Should)**
- Store favorite teams, preferences, conversation history
- Custom mode schedule overrides
- Quick access to relevant information

#### CORE FEATURES

**1. Notification System (Should)**
- Game start notifications
- Score change alerts (favorite teams)
- Final score notifications
- Mode transition notifications
- Breaking news alerts

**2. Context Retention (Should)**
- Remember conversation context across mode switches
- Maintain thread history per topic
- Smart context summary when switching modes

**3. Multi-Sport Dashboard (Should)**
- /dashboard command showing personalized overview
- Live scores for favorited teams
- Upcoming games countdown
- Today's schedule across all sports

**4. Live Game Updates (Should)**
- Real-time score push notifications
- Subscribe to specific games
- Play-by-play summaries
- Game state change alerts

#### SPORTS FEATURES

**1. Enhanced Betting Tools (Could)**
- Odds movement tracking (opening vs current)
- Historical odds trends
- Line movement alerts
- Arbitrage opportunities detection
- Parlay calculator integration

**2. Player-Specific Data (Could)**
- Individual player stats (season/game)
- Injury status and updates
- Player prop betting odds
- Performance trends

**3. Game Predictions (Could)**
- AI-powered game analysis
- Head-to-head history
- Recent form analysis
- Betting recommendation with rationale

### Monetization & Sustainability

**1. Premium Tier (Should)**
- **Free**: Basic scores, news, 10 LLM calls/day
- **Premium ($5/month)**: Unlimited API calls, custom schedules, notifications, advanced betting tools

**2. Sponsorships (Could)**
- Sportsbook affiliate partnerships
- Exclusive odds from specific books
- Sponsored content (clearly marked)

### Implementation Roadmap

**Phase 1 (Months 1-2): Foundation**
- Smart onboarding
- Rich formatting and inline buttons
- Contextual error messages
- Critical security improvements (secrets, encryption, validation)
- **Supabase:** Composite indexes, RLS policies, migration setup
- Circuit breaker and health checks

**Phase 2 (Months 3-4): Engagement**
- User profiles with favorites
- Multi-sport dashboard
- Notification system
- Monitoring stack (Prometheus, Grafana, Loki)
- Live game webhook integration

**Phase 3 (Months 5-6): Monetization**
- Premium tier rollout
- Enhanced betting tools
- Admin dashboard
- Sponsorship partnerships

**Phase 4 (Months 7+): Advanced Features**
- Fantasy sports integration
- Game predictions
- Advanced betting analytics

### Success Metrics

**User Engagement**
- Daily Active Users (DAU)
- Average commands per session
- Mode switch frequency
- Notification opt-in rate

**Feature Adoption**
- Command usage distribution
- Sports data query patterns
- Profile completion rate

**Retention**
- 7-day retention
- 30-day retention
- Churn rate by segment

**Technical Performance**
- API response time (p95)
- Uptime percentage
- Error rate
- Cost per 1,000 queries

---

*Document Version: 6.0*
*Last Updated: 2026-01-17*
*Features: Telegram | OpenRouter | ESPN API | The Odds API | PostgreSQL | Redis | Firecrawl*
