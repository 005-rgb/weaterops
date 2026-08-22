import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().trim().min(1, 'DATABASE_URL is required'),
  SESSION_KEY_SALT: z.string().min(16).default('weatherops-development-salt'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  RETENTION_DAYS: z.coerce.number().int().positive().default(7),
  BMKG_BASE_URL: z.string().optional(),
  BMKG_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  BMKG_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(60),
  BMKG_SCHEMA_FAIL_THRESHOLD_PCT: z.coerce.number().min(0).max(100).default(1),
  WEATHER_FRESHNESS_MINUTES: z.coerce.number().positive().default(60),
  TURNSTILE_SECRET_KEY: z.string().optional(),
  TURNSTILE_SITE_KEY: z.string().optional(),
  IP_HASH_SALT: z.string().min(16).default('weatherops-ip-development-salt'),
  RATE_LIMIT_ANALYSES_PER_MIN: z.coerce.number().int().positive().default(10),
  RISK_SCORE_CAPTCHA_THRESHOLD: z.coerce.number().int().min(0).max(100).default(70),
  SESSION_QUOTA_PER_24H: z.coerce.number().int().positive().default(20),
  POW_DIFFICULTY: z.coerce.number().int().min(1).max(6).default(3),
  POW_TTL_MS: z.coerce.number().int().positive().default(120000),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  INTERNAL_DEBUG_TOKEN: z.string().optional(),
  BOUNDARY_SIMPLIFY_TOLERANCE: z.coerce.number().positive().default(0.001),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // dotenv keeps empty assignments as "", which would coerce to 0 and
  // bypass Zod defaults for numeric optional settings.
  const normalizedSource = {
    ...source,
    BMKG_RATE_LIMIT_PER_MIN: source.BMKG_RATE_LIMIT_PER_MIN?.trim() || undefined,
    SESSION_KEY_SALT: source.SESSION_KEY_SALT?.trim() || undefined,
    IP_HASH_SALT: source.IP_HASH_SALT?.trim() || undefined,
  };
  const result = envSchema.safeParse(normalizedSource);
  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${message}`);
  }
  return result.data;
}

export const env = loadEnv();