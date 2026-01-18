/**
 * Standings Scraper Unit Tests
 * Tests for web scraping ESPN standings pages
 */

import { describe, it, mock, before } from 'node:test';
import assert from 'node:assert';

// Mock the web scraper MCP tool
const mockScrapeResponse = {
  data: `
    <html>
      <body>
        <div class="StandingsHeaders">
          <div class="mt3">
            <h2>EASTERN CONFERENCE</h2>
            <table class="standings-table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>W</th>
                  <th>L</th>
                  <th>PCT</th>
                  <th>STRK</th>
                </tr>
              </thead>
              <tbody>
                <tr class="standings-row">
                  <td class="team-name">
                    <span class="team-logo">
                      <a href="/nba/team/_/name/bos/boston-celtics">Boston Celtics</a>
                    </span>
                  </td>
                  <td>25</td>
                  <td>15</td>
                  <td>.625</td>
                  <td>W 3</td>
                </tr>
                <tr class="standings-row">
                  <td class="team-name">
                    <span class="team-logo">
                      <a href="/nba/team/_/name/mia/miami-heat">Miami Heat</a>
                    </span>
                  </td>
                  <td>22</td>
                  <td>18</td>
                  <td>.550</td>
                  <td>L 2</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="mt3">
            <h2>WESTERN CONFERENCE</h2>
            <table class="standings-table">
              <tbody>
                <tr class="standings-row">
                  <td class="team-name">
                    <span class="team-logo">
                      <a href="/nba/team/_/name/okc/oklahoma-city-thunder">Oklahoma City Thunder</a>
                    </span>
                  </td>
                  <td>28</td>
                  <td>13</td>
                  <td>.683</td>
                  <td>W 5</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </body>
    </html>
  `
};

// Mock scraper module
let mockScraper;
let mockScraperCalls = [];

describe('StandingsScraper', () => {
  let scraper;

  before(async () => {
    // Mock the scraper module - returns markdown format
    mockScraper = async (url) => {
      mockScraperCalls.push(url);
      if (url.includes('espn.com/nba/standings')) {
        return `
Eastern Conference
| 1Image 1: DETDetroit Pistons |
| 2Image 2: NYNew York Knicks |
| 3Image 3: BOSBoston Celtics |

| 28 | 9 | .757 | - | 14-3 | 13-6 | 7-3 | 20-6 | 118.5 | 111.6 | +6.9 | W 3 | 7-3 |
| 24 | 13 | .649 | 4 | 16-4 | 7-9 | 5-3 | 18-11 | 119.7 | 115.0 | +4.7 | W 1 | 5-5 |
| 25 | 13 | .639 | 4.5 | 11-6 | 12-7 | 5-4 | 16-8 | 117.6 | 110.6 | +7.0 | L 1 | 8-2 |

Western Conference
| 1Image 1: OKCOklahoma City Thunder |
| 2Image 2: SASAn Antonio Spurs |
| 3Image 3: DENDENDenver Nuggets |

| 31 | 7 | .816 | - | 18-2 | 13-4 | 7-2 | 25-6 | 121.4 | 108.1 | +13.3 | W 1 | 6-4 |
| 26 | 11 | .703 | 4.5 | 13-5 | 12-6 | 7-1 | 15-9 | 119.0 | 113.3 | +5.7 | W 1 | 6-4 |
| 25 | 12 | .676 | 5.5 | 10-5 | 15-7 | 4-1 | 16-7 | 124.1 | 118.0 | +6.1 | W 2 | 5-5 |
`;
      }
      throw new Error('URL not supported');
    };

    // Import after mock is set
    const scraperModule = await import('../../src/clients/standings-scraper.js');
    scraper = new scraperModule.default({ scraper: mockScraper });
  });

  describe('scrapeStandings', () => {
    it('should scrape and parse NBA standings from ESPN', async () => {
      const result = await scraper.scrapeStandings('nba');

      assert.strictEqual(result.sport, 'nba');
      assert.strictEqual(result.league, 'NBA');
      assert.ok(result.lastUpdated);
      assert.ok(result.standings.eastern);
      assert.ok(result.standings.western);
    });

    it('should parse Eastern Conference standings', async () => {
      const result = await scraper.scrapeStandings('nba');

      const eastern = result.standings.eastern;
      assert.ok(Array.isArray(eastern));
      assert.ok(eastern.length > 0);

      const celtics = eastern.find(t => t.team === 'Boston Celtics');
      assert.ok(celtics);
      assert.strictEqual(celtics.wins, 25);
      assert.strictEqual(celtics.losses, 13);
      assert.strictEqual(celtics.winPercentage, 0.639);
      assert.strictEqual(celtics.streak, 'L 1');
    });

    it('should parse Western Conference standings', async () => {
      const result = await scraper.scrapeStandings('nba');

      const western = result.standings.western;
      assert.ok(Array.isArray(western));

      const thunder = western.find(t => t.team === 'Oklahoma City Thunder');
      assert.ok(thunder);
      assert.strictEqual(thunder.wins, 31);
      assert.strictEqual(thunder.losses, 7);
      assert.strictEqual(thunder.winPercentage, 0.816);
      assert.strictEqual(thunder.streak, 'W 1');
    });

    it('should include conference rank', async () => {
      const result = await scraper.scrapeStandings('nba');

      const eastern = result.standings.eastern;
      const celtics = eastern.find(t => t.team === 'Boston Celtics');
      assert.strictEqual(celtics.conferenceRank, 3);
    });

    it('should throw error for invalid league', async () => {
      await assert.rejects(
        async () => await scraper.scrapeStandings('invalid'),
        /Invalid league/
      );
    });

    it('should handle empty HTML gracefully', async () => {
      mockScraper = async () => '<html><body></body></html>';
      scraper = new (await import('../../src/clients/standings-scraper.js')).default({ scraper: mockScraper });

      const result = await scraper.scrapeStandings('nba');
      assert.strictEqual(result.standings.eastern.length, 0);
      assert.strictEqual(result.standings.western.length, 0);
    });

    it('should handle missing team data', async () => {
      const incompleteMarkdown = `
Eastern Conference
| 1Image 1: TESTTest Team |

| 0 | 0 | .000 | - | 0-0 | 0-0 | 0-0 | 0-0 | 0 | 0 | 0 | - | 0-0 |

Western Conference
| 1Image 1: OKCOklahoma City Thunder |

| 31 | 7 | .816 | - | 18-2 | 13-4 | 7-2 | 25-6 | 121.4 | 108.1 | +13.3 | W 1 | 6-4 |
`;
      mockScraper = async () => incompleteMarkdown;
      scraper = new (await import('../../src/clients/standings-scraper.js')).default({ scraper: mockScraper });

      const result = await scraper.scrapeStandings('nba');
      // When wins is 0, the team is still included but with 0 values
      assert.ok(result.standings.western[0].team);
      assert.strictEqual(typeof result.standings.western[0].wins, 'number');
    });
  });

  describe('_parseTeamMarkdownRow', () => {
    it('should parse team row with all fields', () => {
      const rowMarkdown = '| 1Image 1: DETDetroit Pistons |';

      const result = scraper._parseTeamMarkdownRow(rowMarkdown);
      assert.strictEqual(result.team, 'Detroit Pistons');
      assert.strictEqual(result.abbreviation, 'DET');
    });

    it('should parse different team abbreviations', () => {
      const bosRow = '| 3Image 3: BOSBoston Celtics |';
      const nyRow = '| 2Image 2: NYNNew York Knicks |';
      const okcRow = '| 1Image 1: OKCOklahoma City Thunder |';

      assert.strictEqual(scraper._parseTeamMarkdownRow(bosRow).abbreviation, 'BOS');
      assert.strictEqual(scraper._parseTeamMarkdownRow(nyRow).abbreviation, 'NYN');
      assert.strictEqual(scraper._parseTeamMarkdownRow(okcRow).abbreviation, 'OKC');
    });
  });

  describe('_getStandingsUrl', () => {
    it('should return correct ESPN URL for NBA', () => {
      const url = scraper._getStandingsUrl('nba');
      assert.ok(url.includes('espn.com/nba/standings'));
    });

    it('should throw error for invalid league', () => {
      assert.throws(
        () => scraper._getStandingsUrl('invalid'),
        /Invalid league/
      );
    });
  });

  describe('_parseWinPercentage', () => {
    it('should parse decimal win percentage', () => {
      assert.strictEqual(scraper._parseWinPercentage('.625'), 0.625);
      assert.strictEqual(scraper._parseWinPercentage('.500'), 0.500);
    });

    it('should handle edge cases', () => {
      assert.strictEqual(scraper._parseWinPercentage(''), 0);
      assert.strictEqual(scraper._parseWinPercentage('N/A'), 0);
    });
  });

  describe('_parseStreak', () => {
    it('should parse win streak', () => {
      assert.strictEqual(scraper._parseStreak('W 3'), 'W 3');
      assert.strictEqual(scraper._parseStreak('W 10'), 'W 10');
    });

    it('should parse loss streak', () => {
      assert.strictEqual(scraper._parseStreak('L 2'), 'L 2');
      assert.strictEqual(scraper._parseStreak('L 5'), 'L 5');
    });

    it('should handle empty values', () => {
      assert.strictEqual(scraper._parseStreak(''), '-');
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when scraper works', async () => {
      const result = await scraper.healthCheck();

      assert.strictEqual(result.status, 'healthy');
      assert.ok(typeof result.latency === 'number');
    });

    it('should return unhealthy when scraper fails', async () => {
      mockScraper = async () => {
        throw new Error('Network error');
      };
      scraper = new (await import('../../src/clients/standings-scraper.js')).default({ scraper: mockScraper });

      const result = await scraper.healthCheck();
      assert.strictEqual(result.status, 'unhealthy');
    });
  });
});
