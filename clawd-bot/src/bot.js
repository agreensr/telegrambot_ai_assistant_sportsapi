/**
 * Clawd Bot - Main Bot Logic
 * Telegram bot with time-based LLM switching and sports data integration
 */

import { Telegraf } from 'telegraf';
import openRouterClient from './clients/openrouter-client.js';
import sportsClient from './clients/sports-client.js';
import contextRouter from './services/context-router.js';
import conversationStore from './services/conversation-store.js';
import logger from './utils/logger.js';

// Initialize bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Supported sports
const SUPPORTED_SPORTS = ['nfl', 'nba', 'mlb', 'nhl', 'ncaaf', 'ncaab'];

/**
 * Get conversation ID for a chat
 */
function getConversationId(ctx) {
  const chatId = ctx.chat.id.toString();
  const userId = ctx.from.id.toString();
  const username = ctx.from.username || null;
  return conversationStore.getOrCreateConversation(chatId, userId, username);
}

/**
 * Handle sports commands (e.g., /nfl, /nba scores)
 */
async function handleSportsCommand(ctx, sport, subcommand = 'scores') {
  try {
    const conversationId = getConversationId(ctx);

    switch (subcommand) {
      case 'scores':
      case 'score':
        await ctx.reply(`🔍 Fetching ${sport.toUpperCase()} scores...`);
        const scoresData = await sportsClient.getScores(sport);
        const scoresMessage = sportsClient.formatScoresForBot(scoresData, sport);
        await ctx.reply(scoresMessage);
        conversationStore.addMessage(conversationId, 'user', ctx.message.text, 'sports', 'llama');
        conversationStore.addMessage(conversationId, 'assistant', scoresMessage, 'sports', 'llama');
        break;

      case 'odds':
      case 'lines':
        await ctx.reply(`🔍 Fetching ${sport.toUpperCase()} odds...`);
        const oddsData = await sportsClient.getOdds(sport);
        const oddsMessage = sportsClient.formatOddsForBot(oddsData, sport);
        await ctx.reply(oddsMessage);
        conversationStore.addMessage(conversationId, 'user', ctx.message.text, 'sports', 'llama');
        conversationStore.addMessage(conversationId, 'assistant', oddsMessage, 'sports', 'llama');
        break;

      case 'news':
        await ctx.reply(`🔍 Fetching ${sport.toUpperCase()} news...`);
        const newsData = await sportsClient.getNews(sport, 5);
        const newsMessage = sportsClient.formatNewsForBot(newsData, sport);
        await ctx.reply(newsMessage);
        conversationStore.addMessage(conversationId, 'user', ctx.message.text, 'sports', 'llama');
        conversationStore.addMessage(conversationId, 'assistant', newsMessage, 'sports', 'llama');
        break;

      case 'standings':
        await ctx.reply(`🔍 Fetching ${sport.toUpperCase()} standings...`);
        const standingsData = await sportsClient.getStandings(sport);
        const standingsMessage = sportsClient.formatStandingsForBot(standingsData, sport);
        await ctx.reply(standingsMessage);
        conversationStore.addMessage(conversationId, 'user', ctx.message.text, 'sports', 'llama');
        conversationStore.addMessage(conversationId, 'assistant', standingsMessage, 'sports', 'llama');
        break;

      default:
        await ctx.reply(`Unknown subcommand: ${subcommand}\nAvailable: scores, odds, news, standings`);
    }
  } catch (error) {
    logger.error(`Sports command error: ${error.message}`);
    await ctx.reply(`❌ Error fetching ${sport.toUpperCase()} ${subcommand}: ${error.message}`);
  }
}

// ============ COMMAND HANDLERS ============

/**
 * /start - Welcome message
 */
bot.start((ctx) => {
  const conversationId = getConversationId(ctx);
  logger.info(`User ${ctx.from.id} started the bot`);

  ctx.reply(
    `🤖 *Welcome to Clawd Bot!*\\n\\n` +
    `I'm your context\\-aware AI assistant\\. I automatically switch between specialized modes based on your daily schedule:\\n\\n` +
    `🌅 *5:00\\-6:30 AM* – Trading Prep\\n` +
    `💪 *7:15\\-8:15 AM* – Exercise\\n` +
    `📈 *8:30\\-9:30 AM* – Active Trading\\n` +
    `💻 *9:30 AM\\-2:00 PM* – Productivity & Coding\\n` +
    `🏈 *After 2:00 PM* – Sports Mode\\n\\n` +
    `Use /help to see all commands\\.`,
    { parse_mode: 'MarkdownV2' }
  );
});

/**
 * /help - Show all commands
 */
bot.help((ctx) => {
  ctx.reply(
    `*📚 Clawd Bot Commands*\\n\\n` +
    `*Context Mode*\\n` +
    `/mode – Show current mode & LLM\\n` +
    `/schedule – View daily schedule\\n` +
    `/trading – Switch to trading mode\\n` +
    `/fitness – Switch to fitness mode\\n` +
    `/productivity – Switch to productivity mode\\n` +
    `/sports – Switch to sports mode\\n` +
    `/auto – Return to auto\\-switching\\n\\n` +
    `*Sports Commands*\\n` +
    `/scores – All current scores\\n` +
    `/nfl – NFL scores\\n` +
    `/nba – NBA scores\\n` +
    `/mlb – MLB scores\\n` +
    `/nhl – NHL scores\\n` +
    `/odds – Betting odds\\n` +
    `/news – Sports news\\n` +
    `/standings – League standings\\n\\n` +
    `*Conversation*\\n` +
    `/clear – Clear conversation history\\n\\n` +
    `Just chat with me normally for LLM responses\\!`,
    { parse_mode: 'MarkdownV2' }
  );
});

/**
 * /mode - Show current mode
 */
bot.command('mode', (ctx) => {
  const status = contextRouter.getStatus();
  const modeInfo =
    `🤖 *Current Mode*\\n\\n` +
    `*${status.currentMode}*\\n` +
    `Mode: \\`${status.mode}\\`\\n` +
    `Model: \\`${status.model}\\`\\n` +
    `Time: ${status.currentTime}\\n\\n` +
    `${status.description}`;

  ctx.reply(modeInfo, { parse_mode: 'MarkdownV2' });
});

/**
 * /schedule - Show daily schedule
 */
bot.command('schedule', (ctx) => {
  const schedule = contextRouter.getSchedule();
  let message = '*📅 Daily Schedule (CST)*\\n\\n';

  for (const block of schedule) {
    const indicator = block.isActive ? '🟢' : '⚪';
    message += `${indicator} *${block.startTime} - ${block.endTime}*\\n`;
    message += `   ${block.name}\\n`;
    message += `   Model: \\`${block.model}\\`\\n\\n`;
  }

  ctx.reply(message, { parse_mode: 'MarkdownV2' });
});

/**
 * /trading - Switch to trading mode
 */
bot.command('trading', (ctx) => {
  const context = contextRouter.setManualMode('trading');
  ctx.reply(
    `📈 Switched to *Trading Mode*\\n\\nModel: \\`${context.model}\\`\\n${context.description}\\n\\nUse /auto to return to auto\\-switching`,
    { parse_mode: 'MarkdownV2' }
  );
});

/**
 * /fitness - Switch to fitness mode
 */
bot.command('fitness', (ctx) => {
  const context = contextRouter.setManualMode('fitness');
  ctx.reply(
    `💪 Switched to *Fitness Mode*\\n\\nModel: \\`${context.model}\\`\\n${context.description}\\n\\nUse /auto to return to auto\\-switching`,
    { parse_mode: 'MarkdownV2' }
  );
});

/**
 * /productivity - Switch to productivity mode
 */
bot.command('productivity', (ctx) => {
  const context = contextRouter.setManualMode('productivity');
  ctx.reply(
    `💻 Switched to *Productivity Mode*\\n\\nModel: \\`${context.model}\\`\\n${context.description}\\n\\nUse /auto to return to auto\\-switching`,
    { parse_mode: 'MarkdownV2' }
  );
});

/**
 * /sports - Switch to sports mode
 */
bot.command('sports', async (ctx) => {
  const context = contextRouter.setManualMode('sports');
  await ctx.reply(
    `🏈 Switched to *Sports Mode*\\n\\nModel: \\`${context.model}\\`\\n${context.description}\\n\\nUse /auto to return to auto\\-switching`,
    { parse_mode: 'MarkdownV2' }
  );
});

/**
 * /auto - Return to auto-switching
 */
bot.command('auto', (ctx) => {
  const context = contextRouter.clearManualMode();
  ctx.reply(
    `🔄 Returned to *Auto Mode*\\n\\nNow: ${context.name}\\nModel: \\`${context.model}\\``,
    { parse_mode: 'MarkdownV2' }
  );
});

/**
 * /scores - Show all sports scores
 */
bot.command('scores', async (ctx) => {
  try {
    await ctx.reply('🔍 Fetching scores for all sports...');

    const sports = SUPPORTED_SPORTS.slice(0, 3); // Limit to 3 for performance
    let message = '🏆 *Current Scores*\\n\\n';

    for (const sport of sports) {
      try {
        const data = await sportsClient.getScores(sport);
        const scores = sportsClient.formatScoresForBot(data, sport);
        message += `*${sport.toUpperCase()}*\\n${scores}\\n\\n`;
      } catch (error) {
        message += `*${sport.toUpperCase()}*\\n❌ Error fetching data\\n\\n`;
      }
    }

    await ctx.reply(message, { parse_mode: 'MarkdownV2' });
  } catch (error) {
    logger.error(`Scores command error: ${error.message}`);
    await ctx.reply(`❌ Error fetching scores: ${error.message}`);
  }
});

/**
 * /odds - Show betting odds
 */
bot.command('odds', async (ctx) => {
  try {
    await ctx.reply('🔍 Fetching betting odds...');
    const data = await sportsClient.getOdds('nfl'); // Default to NFL
    const message = sportsClient.formatOddsForBot(data, 'nfl');
    await ctx.reply(message);
  } catch (error) {
    logger.error(`Odds command error: ${error.message}`);
    await ctx.reply(`❌ Error fetching odds: ${error.message}`);
  }
});

/**
 * /news - Show sports news
 */
bot.command('news', async (ctx) => {
  try {
    await ctx.reply('🔍 Fetching sports news...');
    const data = await sportsClient.getNews('nfl', 5);
    const message = sportsClient.formatNewsForBot(data, 'nfl');
    await ctx.reply(message);
  } catch (error) {
    logger.error(`News command error: ${error.message}`);
    await ctx.reply(`❌ Error fetching news: ${error.message}`);
  }
});

/**
 * /standings - Show league standings
 */
bot.command('standings', async (ctx) => {
  try {
    await ctx.reply('🔍 Fetching standings...');
    const data = await sportsClient.getStandings('nfl');
    const message = sportsClient.formatStandingsForBot(data, 'nfl');
    await ctx.reply(message);
  } catch (error) {
    logger.error(`Standings command error: ${error.message}`);
    await ctx.reply(`❌ Error fetching standings: ${error.message}`);
  }
});

/**
 * Sport-specific commands (e.g., /nfl, /nba)
 */
SUPPORTED_SPORTS.forEach((sport) => {
  bot.command(sport, (ctx) => handleSportsCommand(ctx, sport, 'scores'));
});

/**
 * Sport + subcommand (e.g., /nfl_odds, /nba_news)
 */
SUPPORTED_SPORTS.forEach((sport) => {
  const subcommands = ['odds', 'news', 'standings'];
  subcommands.forEach((subcommand) => {
    bot.command(`${sport}_${subcommand}`, (ctx) => handleSportsCommand(ctx, sport, subcommand));
  });
});

/**
 * /clear - Clear conversation history
 */
bot.command('clear', (ctx) => {
  const conversationId = getConversationId(ctx);
  const deletedCount = conversationStore.clearHistory(conversationId);
  ctx.reply(`🗑️ Cleared ${deletedCount} messages from conversation history.`);
});

// ============ TEXT MESSAGE HANDLER (LLM CHAT) ============

/**
 * Handle regular text messages with LLM
 */
bot.on('text', async (ctx) => {
  const userMessage = ctx.message.text;
  const conversationId = getConversationId(ctx);

  // Check if this might be a sports query (detect keywords)
  const sportsKeywords = ['scores', 'odds', 'standings', 'news', 'nfl', 'nba', 'mlb', 'nhl'];
  const hasSportsKeyword = sportsKeywords.some(keyword =>
    userMessage.toLowerCase().includes(keyword)
  );

  // If in sports mode or has sports keywords, check if we should handle as sports command
  const currentContext = contextRouter.getCurrentContext();
  if (currentContext.mode === 'sports' || hasSportsKeyword) {
    // Check for specific sport mentions
    const mentionedSport = SUPPORTED_SPORTS.find(sport =>
      userMessage.toLowerCase().includes(sport)
    );

    if (mentionedSport) {
      if (userMessage.toLowerCase().includes('odds') || userMessage.toLowerCase().includes('lines')) {
        await handleSportsCommand(ctx, mentionedSport, 'odds');
        return;
      } else if (userMessage.toLowerCase().includes('news')) {
        await handleSportsCommand(ctx, mentionedSport, 'news');
        return;
      } else if (userMessage.toLowerCase().includes('standings')) {
        await handleSportsCommand(ctx, mentionedSport, 'standings');
        return;
      } else {
        await handleSportsCommand(ctx, mentionedSport, 'scores');
        return;
      }
    } else if (userMessage.toLowerCase().includes('odds') || userMessage.toLowerCase().includes('lines')) {
      await handleSportsCommand(ctx, 'nfl', 'odds');
      return;
    }
  }

  // Handle as LLM chat
  try {
    // Show typing indicator
    await ctx.telegram.sendChatAction(ctx.chat.id, 'typing');

    // Get conversation history
    const history = conversationStore.getMessagesForLLM(conversationId);

    // Add user message to history
    history.push({ role: 'user', content: userMessage });
    conversationStore.addMessage(conversationId, 'user', userMessage, currentContext.mode, currentContext.model);

    // Get LLM response
    const response = await openRouterClient.chat(history, {
      model: currentContext.model,
      mode: currentContext.mode
    });

    // Send response
    await ctx.reply(response.content);

    // Save assistant response
    conversationStore.addMessage(conversationId, 'assistant', response.content, currentContext.mode, currentContext.model);

    logger.debug(`LLM response: ${currentContext.mode}/${currentContext.model}`);
  } catch (error) {
    logger.error(`LLM error: ${error.message}`);
    await ctx.reply(`❌ Error generating response: ${error.message}`);
  }
});

// ============ ERROR HANDLING ============

bot.catch((err, ctx) => {
  logger.error(`Bot error for ${ctx.updateType}: ${err.message}`);
  ctx.reply('❌ An error occurred. Please try again.');
});

// ============ EXPORT ============

export default bot;
