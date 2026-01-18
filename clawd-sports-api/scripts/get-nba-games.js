#!/usr/bin/env node
/**
 * Fetch NBA games for tonight from ESPN API
 */

import ESPNClient from '../src/clients/espn-client.js';

const client = new ESPNClient();

async function getNBAGames() {
  try {
    console.log('🏀 Fetching NBA games from ESPN...\n');

    const result = await client.getScoreboard('nba');

    console.log(`League: ${result.league}`);
    console.log(`Total Games: ${result.games.length}\n`);

    if (result.games.length === 0) {
      console.log('No NBA games found for today.');
      return;
    }

    result.games.forEach((game, index) => {
      const statusIcon = game.status.type.state === 'in' ? '🔴'
        : game.status.type.state === 'pre' ? '⏰'
        : game.status.type.state === 'post' ? '✅'
        : '❓';

      const time = game.status.type.state === 'in'
        ? `${game.status.clock} Q${game.status.period}`
        : new Date(game.startTime).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            timeZone: 'America/Chicago'
          });

      console.log(`${statusIcon} Game ${index + 1}`);
      console.log(`   ${game.awayTeam.name} (${game.awayTeam.record || 'N/A'}) @ ${game.homeTeam.name} (${game.homeTeam.record || 'N/A'})`);
      console.log(`   ${game.awayTeam.score !== null ? game.awayTeam.score : '-'} @ ${game.homeTeam.score !== null ? game.homeTeam.score : '-'}`);
      console.log(`   Status: ${game.status.type.detail} (${time})`);
      if (game.venue) console.log(`   Venue: ${game.venue}`);
      if (game.broadcast) console.log(`   Broadcast: ${game.broadcast}`);
      console.log('');
    });

  } catch (error) {
    console.error('Error fetching NBA games:', error.message);
    process.exit(1);
  }
}

getNBAGames();
