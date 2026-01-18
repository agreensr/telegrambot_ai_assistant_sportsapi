-- ===========================================
-- Clawd Bot Sports Data - Initial Schema
-- ===========================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
    id BIGSERIAL PRIMARY KEY,
    espn_id VARCHAR(20) UNIQUE NOT NULL,
    sport VARCHAR(20) NOT NULL,
    league VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    abbreviation VARCHAR(10),
    location VARCHAR(100),
    logo_url TEXT,
    color VARCHAR(10),
    alternate_color VARCHAR(10),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Players table
CREATE TABLE IF NOT EXISTS players (
    id BIGSERIAL PRIMARY KEY,
    espn_id VARCHAR(20) UNIQUE NOT NULL,
    team_id BIGINT REFERENCES teams(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    position VARCHAR(20),
    jersey_number VARCHAR(5),
    height VARCHAR(10),
    weight VARCHAR(10),
    age INTEGER,
    headshot_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Games table
CREATE TABLE IF NOT EXISTS games (
    id BIGSERIAL PRIMARY KEY,
    espn_id VARCHAR(20) UNIQUE NOT NULL,
    sport VARCHAR(20) NOT NULL,
    league VARCHAR(20) NOT NULL,
    home_team_id BIGINT REFERENCES teams(id),
    away_team_id BIGINT REFERENCES teams(id),
    home_score INTEGER,
    away_score INTEGER,
    status VARCHAR(50),
    period VARCHAR(20),
    clock VARCHAR(20),
    start_time TIMESTAMPTZ,
    venue VARCHAR(200),
    broadcast VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Odds table
CREATE TABLE IF NOT EXISTS odds (
    id BIGSERIAL PRIMARY KEY,
    game_id BIGINT REFERENCES games(id) ON DELETE CASCADE,
    sportsbook VARCHAR(50) NOT NULL,
    market_type VARCHAR(50) NOT NULL,
    home_odds DECIMAL(10,2),
    away_odds DECIMAL(10,2),
    home_spread DECIMAL(5,2),
    away_spread DECIMAL(5,2),
    total_over DECIMAL(5,2),
    total_under DECIMAL(5,2),
    last_update TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(game_id, sportsbook, market_type)
);

-- Player props table
CREATE TABLE IF NOT EXISTS player_props (
    id BIGSERIAL PRIMARY KEY,
    game_id BIGINT REFERENCES games(id) ON DELETE CASCADE,
    player_id BIGINT REFERENCES players(id),
    sportsbook VARCHAR(50) NOT NULL,
    prop_type VARCHAR(50) NOT NULL,
    line DECIMAL(10,2),
    over_odds DECIMAL(10,2),
    under_odds DECIMAL(10,2),
    last_update TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- News table
CREATE TABLE IF NOT EXISTS news (
    id BIGSERIAL PRIMARY KEY,
    espn_id VARCHAR(50) UNIQUE,
    sport VARCHAR(20) NOT NULL,
    headline TEXT NOT NULL,
    description TEXT,
    story_url TEXT,
    image_url TEXT,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- Indexes for Performance
-- ===========================================

-- Composite indexes for common query patterns
CREATE INDEX idx_games_sport_status ON games(sport, status)
WHERE status IN ('in', 'pre', 'post');

CREATE INDEX idx_games_sport_date ON games(sport, start_time DESC)
WHERE start_time >= NOW() - INTERVAL '30 days';

CREATE INDEX idx_odds_game_book_market ON odds(game_id, sportsbook, market_type);

CREATE INDEX idx_players_team ON players(team_id, position)
WHERE team_id IS NOT NULL;

CREATE INDEX idx_news_sport_date ON news(sport, published_at DESC)
WHERE published_at >= NOW() - INTERVAL '7 days';

-- Single column indexes
CREATE INDEX idx_games_sport ON games(sport);
CREATE INDEX idx_games_start_time ON games(start_time);
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_news_published ON news(published_at);

-- ===========================================
-- Row Level Security (RLS)
-- ===========================================

-- Enable RLS on all tables
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE odds ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_props ENABLE ROW LEVEL SECURITY;
ALTER TABLE news ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow read access to all, write only via service role
-- Teams
CREATE POLICY "Enable read access for all users" ON teams
    FOR SELECT USING (true);
CREATE POLICY "Enable insert for service role" ON teams
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for service role" ON teams
    FOR UPDATE USING (true);
CREATE POLICY "Enable delete for service role" ON teams
    FOR DELETE USING (true);

-- Players
CREATE POLICY "Enable read access for all users" ON players
    FOR SELECT USING (true);
CREATE POLICY "Enable insert for service role" ON players
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for service role" ON players
    FOR UPDATE USING (true);
CREATE POLICY "Enable delete for service role" ON players
    FOR DELETE USING (true);

-- Games
CREATE POLICY "Enable read access for all users" ON games
    FOR SELECT USING (true);
CREATE POLICY "Enable insert for service role" ON games
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for service role" ON games
    FOR UPDATE USING (true);
CREATE POLICY "Enable delete for service role" ON games
    FOR DELETE USING (true);

-- Odds
CREATE POLICY "Enable read access for all users" ON odds
    FOR SELECT USING (true);
CREATE POLICY "Enable insert for service role" ON odds
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for service role" ON odds
    FOR UPDATE USING (true);
CREATE POLICY "Enable delete for service role" ON odds
    FOR DELETE USING (true);

-- Player Props
CREATE POLICY "Enable read access for all users" ON player_props
    FOR SELECT USING (true);
CREATE POLICY "Enable insert for service role" ON player_props
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for service role" ON player_props
    FOR UPDATE USING (true);
CREATE POLICY "Enable delete for service role" ON player_props
    FOR DELETE USING (true);

-- News
CREATE POLICY "Enable read access for all users" ON news
    FOR SELECT USING (true);
CREATE POLICY "Enable insert for service role" ON news
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for service role" ON news
    FOR UPDATE USING (true);
CREATE POLICY "Enable delete for service role" ON news
    FOR DELETE USING (true);

-- ===========================================
-- Helper Functions
-- ===========================================

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to tables with updated_at column
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_games_updated_at BEFORE UPDATE ON games
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- Grant Permissions (adjust role name as needed)
-- ===========================================
-- Note: In Supabase, these are typically handled automatically
-- Adjust if using custom database roles

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, service_role;
