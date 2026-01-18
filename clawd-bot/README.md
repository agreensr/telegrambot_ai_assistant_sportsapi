# Clawd Bot

Context-aware AI Telegram bot with time-based LLM switching and sports data integration.

## Features

- **Time-based Context Switching** - Automatically switches between specialized LLMs based on your daily schedule
- **Multiple AI Modes** - Trading, Fitness, Productivity, and Sports modes
- **Sports Data Integration** - Live scores, odds, news, and standings from ESPN API and The Odds API
- **Conversation History** - Persistent chat history with SQLite
- **Manual Override** - Switch modes manually or return to auto-switching

## Architecture

```
clawd-bot/
├── src/
│   ├── server.js              # Entry point
│   ├── bot.js                 # Telegraf bot with commands
│   ├── clients/
│   │   ├── openrouter-client.js   # OpenRouter API client
│   │   └── sports-client.js       # Sports API client (connects to clawd-sports-api)
│   ├── services/
│   │   ├── context-router.js      # Time-based LLM switching
│   │   └── conversation-store.js  # SQLite conversation persistence
│   └── utils/
│       └── logger.js              # Winston logging
├── data/                        # SQLite database (volume mount)
├── logs/                        # Application logs (volume mount)
├── Dockerfile
├── docker-compose.yml
├── package.json
└── .env.example
```

## Daily Schedule (CST)

| Time | Mode | LLM | Purpose |
|------|------|-----|---------|
| 5:00-6:30 AM | Trading | gemma-2-9b-it | Trading prep & market analysis |
| 7:15-8:15 AM | Fitness | llama-3.2-3b | Exercise & coaching |
| 8:30-9:30 AM | Trading | gemma-2-9b-it | Active trading |
| 9:30 AM-2:00 PM | Productivity | mistral-7b | Coding & productivity |
| After 2:00 PM | Sports | llama-3.2-3b | Sports updates |

## Setup

### Prerequisites

- Node.js 20+ (for local development)
- Docker & Docker Compose (for deployment)
- Telegram Bot Token (from [@BotFather](https://t.me/botfather))
- OpenRouter API Key (from [openrouter.ai](https://openrouter.ai))
- Sports Data Service running (clawd-sports-api)

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token_here

# OpenRouter API
OPENROUTER_API_KEY=your_openrouter_key_here
OPENROUTER_SITE_URL=https://clawd.bot
OPENROUTER_SITE_NAME=Clawd Bot

# Sports Data Service
SPORTS_API_URL=http://clawd-sports-api:3003
SPORTS_API_TIMEOUT=15000

# Database
DATABASE_PATH=/app/data/conversations.db

# Conversation Settings
MAX_HISTORY_LENGTH=50
CONTEXT_WINDOW_SIZE=10

# Logging
LOG_LEVEL=info
```

### Local Development

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env with your API keys

# Run in development mode
npm run dev
```

### Docker Deployment

```bash
# Build and start
docker compose up -d --build

# View logs
docker compose logs -f clawd-bot

# Stop
docker compose down
```

## Bot Commands

### Context Mode Commands
- `/mode` - Show current mode & LLM
- `/schedule` - View daily schedule
- `/trading` - Switch to trading mode
- `/fitness` - Switch to fitness mode
- `/productivity` - Switch to productivity mode
- `/sports` - Switch to sports mode
- `/auto` - Return to auto-switching

### Sports Commands
- `/scores` - All current scores
- `/nfl` - NFL scores
- `/nba` - NBA scores
- `/mlb` - MLB scores
- `/nhl` - NHL scores
- `/odds` - Betting odds
- `/news` - Sports news
- `/standings` - League standings

### Conversation Commands
- `/clear` - Clear conversation history
- `/help` - Show all commands

### Sports Subcommands
- `/nfl_odds` - NFL betting odds
- `/nba_news` - NBA news
- `/mlb_standings` - MLB standings
- etc.

## Supported Sports

- NFL (National Football League)
- NBA (National Basketball Association)
- MLB (Major League Baseball)
- NHL (National Hockey League)
- NCAAF (College Football)
- NCAAB (College Basketball)

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| telegraf | ^4.16.3 | Telegram Bot framework |
| axios | ^1.6.0 | HTTP client |
| better-sqlite3 | ^9.2.2 | SQLite database |
| winston | ^3.11.0 | Logging |
| dotenv | ^16.3.0 | Environment variables |

## Health Check

The bot exposes a health check endpoint at `http://localhost:3000/health` (for Docker health checks).

## Logs

Logs are written to:
- Console (stdout/stderr)
- `logs/error.log` (error level)
- `logs/combined.log` (all levels)

## Database

The conversation database is stored at `data/conversations.db` (SQLite format).

## License

MIT
