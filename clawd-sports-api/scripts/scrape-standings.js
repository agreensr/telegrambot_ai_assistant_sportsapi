/**
 * Standings Scraper Script
 * Uses web reader MCP to scrape ESPN standings
 */

import espnClient from '../src/clients/espn-client.js';

async function main() {
  const league = process.argv[2] || 'nba';

  console.log(`Fetching ${league.toUpperCase()} standings from ESPN...\n`);

  try {
    const standings = await espnClient.getStandings(league);

    console.log(`${standings.league} Standings`);
    console.log(`Last Updated: ${standings.lastUpdated}\n`);

    console.log('EASTERN CONFERENCE');
    console.log('---------------------');
    standings.standings.eastern.forEach(team => {
      console.log(`${team.conferenceRank}. ${team.team.padEnd(25)} ${team.wins}-${team.losses} (${team.winPercentage.toFixed(3)}) ${team.streak}`);
    });

    console.log('\nWESTERN CONFERENCE');
    console.log('---------------------');
    standings.standings.western.forEach(team => {
      console.log(`${team.conferenceRank}. ${team.team.padEnd(25)} ${team.wins}-${team.losses} (${team.winPercentage.toFixed(3)}) ${team.streak}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
