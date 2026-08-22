import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().trim().min(1, 'DATABASE_URL is required'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  RETENTION_DAYS: z.coerce.number().int().positive().default(7),
  BMKG_BASE_URL: z.string().optional(),
  BMKG_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  BMKG_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(60),
  BMKG_SCHEMA_FAIL_THRESHOLD_PCT: z.coerce.number().min(0).max(100).default(1),
  WEATHER_FRESHNESS_MINUTES: z.coerce.number().positive().default(60),
  TURNSTILE_SECRET_KEY: z.string().optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${message}`);
  }
  return result.data;
}

export const env = loadEnv();