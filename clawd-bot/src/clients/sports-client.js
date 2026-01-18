/**
 * Sports Data Client
 * Connects to clawd-sports-api for sports data
 */

import axios from 'axios';
import logger from '../utils/logger.js';

class SportsClient {
  constructor() {
    this.baseUrl = process.env.SPORTS_API_URL || 'http://clawd-sports-api:3003';
    this.timeout = parseInt(process.env.SPORTS_API_TIMEOUT) || 15000;
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout
    });
  }

  /**
   * Get scores for a sport
   */
  async getScores(sport) {
    try {
      const response = await this.client.get(`/api/scores/${sport}`);
      return response.data;
    } catch (error) {
      logger.error(`Sports API scores error: ${error.message}`);
      throw new Error(`Failed to fetch scores: ${error.message}`);
    }
  }

  /**
   * Get live games only
   */
  async getLiveScores(sport) {
    try {
      const response = await this.client.get(`/api/scores/${sport}/live`);
      return response.data;
    } catch (error) {
      logger.error(`Sports API live scores error: ${error.message}`);
      throw new Error(`Failed to fetch live scores: ${error.message}`);
    }
  }

  /**
   * Get sports news
   */
  async getNews(sport, limit = 5) {
    try {
      const response = await this.client.get(`/api/news/${sport}`, {
        params: { limit }
      });
      return response.data;
    } catch (error) {
      logger.error(`Sports API news error: ${error.message}`);
      throw new Error(`Failed to fetch news: ${error.message}`);
    }
  }

  /**
   * Get betting odds
   */
  async getOdds(sport) {
    try {
      const response = await this.client.get(`/api/odds/${sport}`);
      return response.data;
    } catch (error) {
      logger.error(`Sports API odds error: ${error.message}`);
      throw new Error(`Failed to fetch odds: ${error.message}`);
    }
  }

  /**
   * Get odds for a specific game
   */
  async getGameOdds(gameId) {
    try {
      const response = await this.client.get(`/api/odds/game/${gameId}`);
      return response.data;
    } catch (error) {
      logger.error(`Sports API game odds error: ${error.message}`);
      throw new Error(`Failed to fetch game odds: ${error.message}`);
    }
  }

  /**
   * Get best odds across sportsbooks
   */
  async getBestOdds(sport) {
    try {
      const response = await this.client.get(`/api/odds/best/${sport}`);
      return response.data;
    } catch (error) {
      logger.error(`Sports API best odds error: ${error.message}`);
      throw new Error(`Failed to fetch best odds: ${error.message}`);
    }
  }

  /**
   * Get standings
   */
  async getStandings(sport) {
    try {
      const response = await this.client.get(`/api/standings/${sport}`);
      return response.data;
    } catch (error) {
      logger.error(`Sports API standings error: ${error.message}`);
      throw new Error(`Failed to fetch standings: ${error.message}`);
    }
  }

  /**
   * Get team list
   */
  async getTeams(sport) {
    try {
      const response = await this.client.get(`/api/teams/${sport}`);
      return response.data;
    } catch (error) {
      logger.error(`Sports API teams error: ${error.message}`);
      throw new Error(`Failed to fetch teams: ${error.message}`);
    }
  }

  /**
   * Get available sportsbooks
   */
  async getSportsbooks() {
    try {
      const response = await this.client.get('/api/sportsbooks');
      return response.data;
    } catch (error) {
      logger.error(`Sports API sportsbooks error: ${error.message}`);
      throw new Error(`Failed to fetch sportsbooks: ${error.message}`);
    }
  }

  /**
   * Format scores for Telegram message
   */
  formatScoresForBot(scoresData, sport = '') {
    const games = scoresData.data || scoresData.games || scoresData;
    if (!games || games.length === 0) {
      return `No games found for ${sport.toUpperCase()}.`;
    }

    const sportEmoji = {
      nfl: '🏈',
      nba: '🏀',
      mlb: '⚾',
      nhl: '🏒',
      ncaaf: '🏈',
      ncaab: '🏀'
    };

    return games.slice(0, 10).map(game => {
      const status = game.status?.detail || game.status?.type || 'Scheduled';
      const isLive = game.status?.state === 'in';
      const home = game.homeTeam || game.home_team;
      const away = game.awayTeam || game.away_team;

      const statusIndicator = isLive ? '🔴' :
                              status === 'Final' ? '✅' :
                              '⏰';

      const homeScore = home?.score ?? '-';
      const awayScore = away?.score ?? '-';

      return `${statusIndicator} ${away?.abbreviation || away?.name} ${awayScore} @ ${home?.abbreviation || home?.name} ${homeScore}\n   📍 ${status}`;
    }).join('\n\n');
  }

  /**
   * Format odds for Telegram message
   */
  formatOddsForBot(oddsData, sport = '') {
    const events = oddsData.data || oddsData.games || oddsData;
    if (!events || events.length === 0) {
      return `No odds available for ${sport.toUpperCase()}.`;
    }

    return events.slice(0, 5).map(event => {
      const fanduel = event.bookmakers?.find(b => b.key === 'draftkings' || b.key === 'fanduel');
      const h2h = fanduel?.markets?.find(m => m.key === 'h2h');

      if (!h2h || !h2h.outcomes) {
        return null;
      }

      const homeOutcome = h2h.outcomes.find(o => o.name === event.homeTeam || o.name === event.home_team);
      const awayOutcome = h2h.outcomes.find(o => o.name === event.awayTeam || o.name === event.away_team);

      if (!homeOutcome || !awayOutcome) {
        return null;
      }

      const formatOdds = (price) => {
        if (price > 0) return `+${price}`;
        return price.toString();
      };

      return `💰 ${event.awayTeam || event.away_team} (${formatOdds(awayOutcome.price)}) @ ${event.homeTeam || event.home_team} (${formatOdds(homeOutcome.price)})`;
    }).filter(Boolean).join('\n');
  }

  /**
   * Format news for Telegram message
   */
  formatNewsForBot(newsData, sport = '') {
    const articles = newsData.data || newsData.articles || newsData;
    if (!articles || articles.length === 0) {
      return `No news found for ${sport.toUpperCase()}.`;
    }

    return articles.slice(0, 5).map(article => {
      const headline = article.headline || article.title || 'No headline';
      const description = article.description || '';
      const link = article.link || article.story || article.url;

      let message = `📰 ${headline}`;
      if (description) {
        message += `\n${description.substring(0, 100)}${description.length > 100 ? '...' : ''}`;
      }
      if (link) {
        message += `\n🔗 ${link}`;
      }
      return message;
    }).join('\n\n');
  }

  /**
   * Format standings for Telegram message
   */
  formatStandingsForBot(standingsData, sport = '') {
    const standings = standingsData.standings || standingsData;
    if (!standings) {
      return `No standings available for ${sport.toUpperCase()}.`;
    }

    let message = `🏆 ${standings.league || sport.toUpperCase()} Standings\n\n`;

    if (standings.eastern && standings.eastern.length > 0) {
      message += `📍 Eastern Conference\n`;
      message += standings.eastern.slice(0, 5).map((t, i) => {
        return `${i + 1}. ${t.team} (${t.wins}-${t.losses}) ${t.streak}`;
      }).join('\n');
      message += '\n\n';
    }

    if (standings.western && standings.western.length > 0) {
      message += `📍 Western Conference\n`;
      message += standings.western.slice(0, 5).map((t, i) => {
        return `${i + 1}. ${t.team} (${t.wins}-${t.losses}) ${t.streak}`;
      }).join('\n');
    }

    return message;
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const start = Date.now();
      const response = await this.client.get('/health', { timeout: 5000 });
      const latency = Date.now() - start;

      return {
        status: response.data.status === 'ok' ? 'healthy' : 'unhealthy',
        latency,
        url: this.baseUrl
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        url: this.baseUrl
      };
    }
  }
}

export default new SportsClient();
