/**
 * Server Entry Point
 * Starts the Express HTTP server
 */

import http from 'node:http';
import app from './app.js';
import { logger } from './utils/logger.js';
import { initCache, cacheClient } from './config/cache.js';
import { healthCheck as dbHealthCheck } from './config/database.js';

// Get port from environment or use default
const PORT = process.env.PORT || 3003;
const HOST = process.env.HOST || '0.0.0.0';

/**
 * Initialize services
 */
async function initializeServices() {
  try {
    // Initialize Redis cache
    logger.info('Initializing Redis cache...');
    await initCache();

    if (cacheClient.isConnected) {
      logger.info('Redis cache connected successfully');
    } else {
      logger.warn('Redis cache not available - running without cache');
    }

    // Test database connection
    const dbHealth = await dbHealthCheck();
    if (dbHealth.connected) {
      logger.info('Supabase database connected successfully');
    } else {
      logger.warn('Supabase database health check failed');
    }
  } catch (error) {
    logger.error('Service initialization error:', error);
    logger.warn('Continuing with limited functionality...');
  }
}

/**
 * Create HTTP server
 */
const server = http.createServer(app);

/**
 * Handle server errors
 */
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    logger.error(`Port ${PORT} is already in use`);
  } else {
    logger.error('Server error:', error);
  }
  process.exit(1);
});

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(signal) {
  logger.info(`${signal} received, shutting down gracefully...`);

  // Close cache connection
  try {
    await cacheClient.close();
    logger.info('Cache connection closed');
  } catch (error) {
    logger.error('Error closing cache:', error);
  }

  server.close((err) => {
    if (err) {
      logger.error('Error during server shutdown:', err);
      process.exit(1);
    }

    logger.info('Server closed successfully');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

/**
 * Start listening
 */
async function start() {
  await initializeServices();

  server.listen(PORT, HOST, () => {
    logger.info(`Clawd Sports API server listening on http://${HOST}:${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info('Health check available at /health');
  });
}

start().catch(error => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});

/**
 * Register shutdown handlers
 */
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

/**
 * Handle uncaught exceptions
 */
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  gracefulShutdown('uncaughtException');
});

/**
 * Handle unhandled promise rejections
 */
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});
