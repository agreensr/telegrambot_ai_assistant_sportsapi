/**
 * Test Environment Setup
 * Configures the test environment with mocks and test fixtures.
 */

import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

// Enable test mode
process.env.NODE_ENV = 'test';

// Configure test environment variables
const testEnv = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'error', // Reduce noise in test output
  ESPN_API_TIMEOUT: '5000',
  ESPN_MAX_RETRIES: '2',
  CIRCUIT_BREAKER_THRESHOLD: '5',
  CIRCUIT_BREAKER_RESET_TIMEOUT: '30000',
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6379',
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  THE_ODDS_API_KEY: 'test-odds-key'
};

// Set test environment variables
Object.entries(testEnv).forEach(([key, value]) => {
  if (!process.env[key]) {
    process.env[key] = value;
  }
});

// Export test configuration
export const testConfig = {
  env: testEnv,
  timeout: 5000,
  mockDataDir: new URL('./fixtures/', import.meta.url).pathname
};

// Global test hooks
export async function setupTestEnvironment() {
  // Initialize any shared test resources
  // This runs before all test suites
}

export async function teardownTestEnvironment() {
  // Clean up any shared test resources
  // This runs after all test suites
}

// Register setup/teardown for the test runner
// Note: These are exported for manual use if needed
export default {
  setup: setupTestEnvironment,
  teardown: teardownTestEnvironment,
  config: testConfig
};
