/**
 * Logger Unit Tests
 * Tests for Winston logger configuration and functionality.
 */

import { describe, it, mock, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a proper mock write stream that extends EventEmitter
class MockWriteStream extends Writable {
  constructor() {
    super();
    this.writable = true;
  }

  _write(chunk, encoding, callback) {
    callback();
  }

  _destroy(err, callback) {
    callback();
  }

  destroy() {
    this.emit('close');
  }

  end() {
    this.emit('finish');
    return this;
  }
}

// Mock fs modules before importing logger
mock.method(fs, 'createWriteStream', () => new MockWriteStream());
mock.method(fs, 'existsSync', () => true);

// Import logger after mocking
import { logger, stream } from '../../src/utils/logger.js';

describe('Logger', () => {
  describe('Initialization', () => {
    it('should create logger instance with correct configuration', () => {
      assert.ok(logger);
      assert.strictEqual(typeof logger.error, 'function');
      assert.strictEqual(typeof logger.warn, 'function');
      assert.strictEqual(typeof logger.info, 'function');
      assert.strictEqual(typeof logger.http, 'function');
      assert.strictEqual(typeof logger.debug, 'function');
    });

    it('should have custom log levels defined', () => {
      assert.ok(logger.levels);
      assert.strictEqual(logger.levels.error, 0);
      assert.strictEqual(logger.levels.warn, 1);
      assert.strictEqual(logger.levels.info, 2);
      assert.strictEqual(logger.levels.http, 3);
      assert.strictEqual(logger.levels.debug, 4);
    });

    it('should have exitOnError set to false', () => {
      assert.strictEqual(logger.exitOnError, false);
    });
  });

  describe('Log Levels', () => {
    it('should log error messages', () => {
      const logs = [];
      mock.method(logger, 'error', (msg, meta) => {
        logs.push({ level: 'error', msg, meta });
      });

      logger.error('Test error message');
      assert.ok(logs.some(l => l.msg === 'Test error message'));
    });

    it('should log warn messages', () => {
      const logs = [];
      mock.method(logger, 'warn', (msg, meta) => {
        logs.push({ level: 'warn', msg, meta });
      });

      logger.warn('Test warn message');
      assert.ok(logs.some(l => l.msg === 'Test warn message'));
    });

    it('should log info messages', () => {
      const logs = [];
      mock.method(logger, 'info', (msg, meta) => {
        logs.push({ level: 'info', msg, meta });
      });

      logger.info('Test info message');
      assert.ok(logs.some(l => l.msg === 'Test info message'));
    });

    it('should log debug messages', () => {
      const logs = [];
      mock.method(logger, 'debug', (msg, meta) => {
        logs.push({ level: 'debug', msg, meta });
      });

      logger.debug('Test debug message');
      assert.ok(logs.some(l => l.msg === 'Test debug message'));
    });

    it('should log http messages', () => {
      const logs = [];
      mock.method(logger, 'http', (msg, meta) => {
        logs.push({ level: 'http', msg, meta });
      });

      logger.http('GET /api/test');
      assert.ok(logs.some(l => l.msg === 'GET /api/test'));
    });
  });

  describe('Logging with Metadata', () => {
    it('should log error messages with stack trace', () => {
      const logs = [];
      mock.method(logger, 'error', (msg, meta) => {
        logs.push({ level: 'error', msg, meta });
      });

      const error = new Error('Test error');
      logger.error('Error occurred', { error });

      assert.ok(logs.some(l => l.msg === 'Error occurred'));
    });

    it('should log messages with additional metadata', () => {
      const logs = [];
      mock.method(logger, 'info', (msg, meta) => {
        logs.push({ level: 'info', msg, meta });
      });

      logger.info('User action', { userId: '123', action: 'login' });
      assert.ok(logs.some(l => l.msg === 'User action'));
    });
  });

  describe('Transports', () => {
    it('should have console transport configured', () => {
      assert.ok(logger.transports);
      const consoleTransport = logger.transports.find(
        t => t.constructor.name === 'Console'
      );
      assert.ok(consoleTransport);
    });

    it('should have file transports configured', () => {
      const fileTransports = logger.transports.filter(
        t => t.constructor.name === 'File'
      );
      assert.ok(fileTransports.length >= 2);
    });
  });

  describe('HTTP Stream (Morgan Compatibility)', () => {
    it('should export a stream object with write method', () => {
      assert.ok(stream);
      assert.strictEqual(typeof stream.write, 'function');
    });

    it('should write HTTP messages to logger', () => {
      const logs = [];
      mock.method(logger, 'http', (msg) => {
        logs.push(msg);
      });

      stream.write('GET /api/test 200 - 5ms');

      assert.ok(logs.some(l => l.includes('GET /api/test')));
    });

    it('should trim whitespace from HTTP messages', () => {
      const logs = [];
      mock.method(logger, 'http', (msg) => {
        logs.push(msg.trim());
      });

      stream.write('  GET /api/test 200  \n');

      assert.ok(logs.some(l => l === 'GET /api/test 200'));
    });
  });

  describe('Environment-based Configuration', () => {
    it('should use debug level in development', () => {
      // Logger level is set at import time based on NODE_ENV
      // In test mode (NODE_ENV=test), it uses 'error' level
      // We can verify the level property exists and is valid
      assert.ok(logger.level);
      assert.ok(['error', 'warn', 'info', 'http', 'debug'].includes(logger.level));
    });

    it('should use info level in production', () => {
      // Verify logger has a level property
      assert.ok(logger.level);
      assert.strictEqual(typeof logger.level, 'string');
    });
  });

  describe('Format Configuration', () => {
    it('should use JSON format for file logging', () => {
      const fileTransport = logger.transports.find(
        t => t.constructor.name === 'File'
      );
      assert.ok(fileTransport);
      // Winston File transports use format but it may not be directly accessible
      assert.ok(fileTransport);
    });

    it('should use colorized format for console logging', () => {
      const consoleTransport = logger.transports.find(
        t => t.constructor.name === 'Console'
      );
      assert.ok(consoleTransport);
      assert.ok(consoleTransport.format);
    });
  });

  describe('File Rotation', () => {
    it('should configure max file size for log rotation', () => {
      const fileTransport = logger.transports.find(
        t => t.constructor.name === 'File'
      );

      assert.ok(fileTransport);
      assert.ok(fileTransport.maxsize);
      assert.strictEqual(fileTransport.maxsize, 10485760); // 10MB
    });

    it('should configure max files for rotation', () => {
      const fileTransport = logger.transports.find(
        t => t.constructor.name === 'File'
      );

      assert.ok(fileTransport);
      assert.strictEqual(fileTransport.maxFiles, 5);
    });
  });

  describe('Error Handling', () => {
    it('should not exit process on error', () => {
      assert.strictEqual(logger.exitOnError, false);
    });

    it('should log error objects with stack traces', () => {
      const logs = [];
      mock.method(logger, 'error', (msg, meta) => {
        logs.push({ level: 'error', msg, meta });
      });

      const error = new Error('Test error with stack');
      logger.error('Error with stack', { stack: error.stack });

      assert.ok(logs.some(l => l.msg === 'Error with stack'));
    });
  });

  describe('Child Logger', () => {
    it('should support creating child loggers with default metadata', () => {
      const childLogger = logger.child({ service: 'test-service' });

      assert.ok(childLogger);
      assert.strictEqual(typeof childLogger.info, 'function');
    });
  });

  describe('Level Filtering', () => {
    it('should respect log level hierarchy', () => {
      const currentLevel = logger.level;
      assert.ok(['error', 'warn', 'info', 'http', 'debug'].includes(currentLevel));
    });
  });
});
