/**
 * Supabase Client Configuration
 * Provides self-hosted Supabase connection for sports data persistence.
 *
 * Uses service role key for admin operations (bypasses RLS).
 * For client operations with RLS, use the anon key instead.
 */

import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';

// Validate required environment variables (skip in test mode)
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0 && process.env.NODE_ENV !== 'test') {
  logger.error(`Missing required environment variables: ${missingVars.join(', ')}`);
  throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
}

// In test mode, use placeholder values
const supabaseUrl = process.env.SUPABASE_URL || 'https://test.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'test-anon-key';

/**
 * Supabase admin client (bypasses RLS)
 * Use for backend operations that need full data access
 */
export const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    db: {
      schema: 'public'
    }
  }
);

/**
 * Supabase anon client (respects RLS)
 * Use for operations that should respect Row Level Security
 */
export const supabaseAnon = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

/**
 * Test database connection
 */
export async function testConnection() {
  try {
    const { data, error } = await supabase
      .from('teams')
      .select('id')
      .limit(1);

    if (error) {
      throw error;
    }

    logger.info('Supabase connection established successfully');
    return { success: true, latency: null };
  } catch (error) {
    logger.error('Supabase connection failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Deep health check with latency measurement
 */
export async function healthCheck() {
  const startTime = Date.now();

  try {
    const { data, error } = await supabase
      .from('teams')
      .select('id')
      .limit(1);

    const latency = Date.now() - startTime;

    if (error) {
      throw error;
    }

    return {
      status: 'healthy',
      latency,
      connected: true
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      latency: Date.now() - startTime,
      connected: false,
      error: error.message
    };
  }
}

export default { supabase, supabaseAnon, testConnection, healthCheck };
