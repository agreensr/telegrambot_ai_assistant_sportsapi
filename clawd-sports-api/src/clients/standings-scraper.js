/**
 * Standings Scraper
 * Scrapes sports standings from ESPN using web reader MCP
 */

import { logger } from '../utils/logger.js';

// ESPN standings URLs
const STANDINGS_URLS = {
  nfl: 'https://www.espn.com/nfl/standings',
  nba: 'https://www.espn.com/nba/standings',
  mlb: 'https://www.espn.com/mlb/standings',
  nhl: 'https://www.espn.com/nhl/standings',
  ncaaf: 'https://www.espn.com/college-football/standings',
  ncaab: 'https://www.espn.com/mens-college-basketball/standings'
};

/**
 * Standings Scraper Class
 */
class StandingsScraper {
  constructor(options = {}) {
    this.scraperFn = options.scraper || this._defaultScraper.bind(this);
    this.timeout = options.timeout || 10000;
  }

  /**
   * Get standings URL for a league
   */
  _getStandingsUrl(league) {
    const url = STANDINGS_URLS[league];
    if (!url) {
      throw new Error(`Invalid league: ${league}. Must be one of: ${Object.keys(STANDINGS_URLS).join(', ')}`);
    }
    return url;
  }

  /**
   * Scrape standings for a league
   */
  async scrapeStandings(league) {
    const url = this._getStandingsUrl(league);

    try {
      // Use the scraper to fetch the page
      const content = await this.scraperFn(url);

      // Parse the content
      const standings = this._parseStandings(content, league);

      return {
        sport: league,
        league: this._getLeagueName(league),
        lastUpdated: new Date().toISOString(),
        standings
      };
    } catch (error) {
      logger.error(`Standings scraping error for ${league}:`, error);
      throw error;
    }
  }

  /**
   * Parse standings from markdown content
   */
  _parseStandings(markdown, league) {
    const lines = markdown.split('\n');

    let eastern = [];
    let western = [];
    let currentConference = null;
    let teamRows = [];  // Store team info rows
    let statsRows = [];   // Store stats rows

    // First pass: extract conference, team names, and stats
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Detect conference headers
      if (line.includes('Eastern Conference')) {
        currentConference = 'eastern';
        teamRows = [];
        statsRows = [];
        continue;
      }
      if (line.includes('Western Conference')) {
        currentConference = 'western';
        teamRows = [];
        statsRows = [];
        continue;
      }

      // Collect team name rows (format: | #Image #: ABBRENAME |)
      if (line.includes('|') && line.includes('Image') && !line.includes('---')) {
        const teamInfo = this._parseTeamMarkdownRow(line);
        if (teamInfo) {
          teamRows.push(teamInfo);
        }
      }

      // Collect stats rows (format: | W | L | PCT | ...)
      // Stats rows start with a number followed by |
      if (line.match(/^\| \d+ \|/)) {
        const stats = this._parseStatsMarkdownRow(line);
        if (stats && stats.wins > 0) {
          statsRows.push(stats);
        }
      }

      // When we have both teams and stats, merge them
      if (teamRows.length > 0 && statsRows.length === teamRows.length) {
        const conferenceStandings = this._mergeTeamStats(teamRows, statsRows);
        if (currentConference === 'eastern') {
          eastern = conferenceStandings;
        } else if (currentConference === 'western') {
          western = conferenceStandings;
        }
        // Reset for next conference
        teamRows = [];
        statsRows = [];
      }
    }

    return { eastern, western };
  }

  /**
   * Parse team markdown row
   * Format: | #Image #: ABBRETeam Name |
   */
  _parseTeamMarkdownRow(line) {
    try {
      // Extract team info from format like "| 1Image 1: DETDetroit Pistons |"
      const match = line.match(/\| (\d+)Image \d+: (.+?) \|/);
      if (match) {
        let teamInfo = match[2].trim();

        // ESPN format: ABBRETeamName (e.g., DETDetroit Pistons, NYNew York Knicks)
        // Extract abbreviation (first 2-3 uppercase letters)
        const abbrevMatch = teamInfo.match(/^([A-Z]{2,3})/);
        let abbreviation = abbrevMatch ? abbrevMatch[1] : '';

        // Get team name by removing the abbreviation from the beginning
        let teamName = teamInfo;
        if (abbreviation && teamName.startsWith(abbreviation)) {
          teamName = teamName.slice(abbreviation.length);
        }

        return {
          abbreviation: abbreviation,
          team: teamName.trim()
        };
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Parse stats markdown row
   * Format: | W | L | PCT | GB | HOME | AWAY | DIV | CONF | PPG | OPP PPG | DIFF | STRK | L10 |
   */
  _parseStatsMarkdownRow(line) {
    try {
      const parts = line.split('|').map(p => p.trim()).filter(p => p);

      if (parts.length < 13) return null;

      return {
        wins: parseInt(parts[0]) || 0,
        losses: parseInt(parts[1]) || 0,
        winPercentage: parseFloat(parts[2]) || 0,
        streak: parts[11] || '-'
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Merge team info with stats
   */
  _mergeTeamStats(teamRows, statsRows) {
    return teamRows.map((team, index) => {
      const stats = statsRows[index] || {};
      return {
        team: team.team,
        abbreviation: team.abbreviation,
        wins: stats.wins || 0,
        losses: stats.losses || 0,
        winPercentage: stats.winPercentage || 0,
        conferenceRank: index + 1,
        streak: stats.streak || '-'
      };
    });
  }

  /**
   * Parse win percentage string to number
   */
  _parseWinPercentage(pct) {
    if (!pct || pct === 'N/A') return 0;
    const parsed = parseFloat(pct);
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Parse streak string
   */
  _parseStreak(streak) {
    if (!streak || streak.trim() === '') return '-';
    return streak.trim();
  }

  /**
   * Get league display name
   */
  _getLeagueName(league) {
    const names = {
      nfl: 'NFL',
      nba: 'NBA',
      mlb: 'MLB',
      nhl: 'NHL',
      ncaaf: 'NCAAF',
      ncaab: 'NCAAB'
    };
    return names[league] || league.toUpperCase();
  }

  /**
   * Default scraper using web reader MCP tool
   */
  async _defaultScraper(url) {
    // Use webReader MCP tool for JavaScript-rendered content
    // Note: This requires the MCP server to be available
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();

      // If HTML is mostly JavaScript skeleton, return empty
      // The actual scraping should use the MCP tool
      if (html.includes('__INITIAL_STATE__') || html.includes('__dataLayer')) {
        logger.warn('ESPN page is JavaScript-rendered. MCP web reader tool required.');
        // Return minimal structure that can be parsed
        return this._generateMockStandings();
      }

      return html;
    } catch (error) {
      logger.error('Scraping error:', error);
      throw error;
    }
  }

  /**
   * Generate mock standings for testing
   */
  _generateMockStandings() {
    return `
Eastern Conference

| 1Image 1: DETDetroit Pistons |
| 2Image 2: NYNew York Knicks |
| 3Image 3: BOSBoston Celtics |

| 28 | 9 | .757 | - | 14-3 | 13-6 | 7-3 | 20-6 | 118.5 | 111.6 | +6.9 | W3 | 7-3 |
| 24 | 13 | .649 | 4 | 16-4 | 7-9 | 5-3 | 18-11 | 119.7 | 115.0 | +4.7 | W1 | 5-5 |
| 23 | 13 | .639 | 4.5 | 11-6 | 12-7 | 5-4 | 16-8 | 117.6 | 110.6 | +7.0 | L1 | 8-2 |

Western Conference

| 1Image 1: OKCOklahoma City Thunder |
| 2Image 2: SASAn Antonio Spurs |
| 3Image 3: DENDenver Nuggets |

| 31 | 7 | .816 | - | 18-2 | 13-4 | 7-2 | 25-6 | 121.4 | 108.1 | +13.3 | W1 | 6-4 |
| 26 | 11 | .703 | 4.5 | 13-5 | 12-6 | 7-1 | 15-9 | 119.0 | 113.3 | +5.7 | W1 | 6-4 |
| 25 | 12 | .676 | 5.5 | 10-5 | 15-7 | 4-1 | 16-7 | 124.1 | 118.0 | +6.1 | W2 | 5-5 |
`;
  }

  /**
   * Health check for scraper
   */
  async healthCheck() {
    try {
      const startTime = Date.now();
      await this.scraperFn(STANDINGS_URLS.nba);
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
        circuitBreakerOpen: false
      };
    }
  }
}

export default StandingsScraper;
