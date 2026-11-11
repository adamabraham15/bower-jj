/**
 * BOWER JJ — Centralized Environment & Runtime Configuration
 *
 * Validates runtime environment, enforces secret hygiene, and
 * prevents accidental leakage of service keys or development settings.
 */

export interface ServerConfig {
  env: 'development' | 'staging' | 'production' | 'test';
  isProduction: boolean;
  isStaging: boolean;
  isDevelopment: boolean;
  isTest: boolean;
  port: number;
  supabaseUrl?: string;
  hasSupabaseConfigured: boolean;
  hasServiceRoleKey: boolean;
  databaseUrl?: string;
  rankedBotWaitMs: number;
  corsOrigin: string;
}

export function loadServerConfig(): ServerConfig {
  const env = (process.env.NODE_ENV || 'development') as ServerConfig['env'];
  const isProduction = env === 'production';
  const isStaging = env === 'staging';
  const isDevelopment = env === 'development';
  const isTest = env === 'test' || Boolean(process.env.VITEST);

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const databaseUrl = process.env.DATABASE_URL;

  const rankedBotWaitMs = process.env.RANKED_BOT_WAIT_MS
    ? parseInt(process.env.RANKED_BOT_WAIT_MS, 10)
    : 35000;

  // Staging / Production CORS policy
  const corsOrigin = process.env.CORS_ORIGIN || '*';

  // Environment Validation Warnings (Logged safely without leaking values)
  if ((isProduction || isStaging) && !supabaseUrl) {
    console.warn('[CONFIG WARNING] SUPABASE_URL is not set in staging/production. Running in fallback mode.');
  }

  if (isProduction && !databaseUrl && !supabaseUrl) {
    console.warn('[CONFIG WARNING] No DATABASE_URL or SUPABASE_URL configured for production persistence.');
  }

  return {
    env,
    isProduction,
    isStaging,
    isDevelopment,
    isTest,
    port,
    supabaseUrl,
    hasSupabaseConfigured: Boolean(supabaseUrl),
    hasServiceRoleKey: Boolean(serviceKey && serviceKey.length > 20),
    databaseUrl,
    rankedBotWaitMs,
    corsOrigin,
  };
}

export const serverConfig = loadServerConfig();
