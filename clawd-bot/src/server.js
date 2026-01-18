/**
 * Clawd Bot - Server Entry Point
 * Starts the Telegram bot with all services
 */

import dotenv from 'dotenv';
import bot from './bot.js';
import conversationStore from './services/conversation-store.js';
import logger from './utils/logger.js';

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['TELEGRAM_BOT_TOKEN', 'OPENROUTER_API_KEY'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  logger.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  logger.error('Please set up your .env file from .env.example');
  process.exit(1);
}

// Graceful shutdown handler
function setupGracefulShutdown() {
  const shutdown = (signal) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);

    bot.stop()
      .then(() => {
        conversationStore.close();
        logger.info('Bot stopped successfully');
        process.exit(0);
      })
      .catch((error) => {
        logger.error(`Error during shutdown: ${error.message}`);
        process.exit(1);
      });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Start the bot
async function start() {
  try {
    logger.info('🤖 Starting Clawd Bot...');

    // Initialize conversation store
    conversationStore.initialize();
    logger.info('💾 Conversation store initialized');

    // Start bot polling
    await bot.launch();
    logger.info('✅ Clawd Bot is running!');
    logger.info(`📱 Bot username: ${bot.botInfo?.username || 'unknown'}`);

    // Log current context
    const { contextRouter } = await import('./services/context-router.js');
    const status = contextRouter.getStatus();
    logger.info(`🕐 Current mode: ${status.currentMode} (${status.model})`);
    logger.info(`📅 Current time: ${status.currentTime} CST`);
    logger.info('🔄 Auto-switching enabled');

  } catch (error) {
    logger.error(`Failed to start bot: ${error.message}`);
    process.exit(1);
  }
}

// Setup graceful shutdown
setupGracefulShutdown();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// Start server
start();
