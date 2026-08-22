import { z } from 'zod';

import { env } from '../../app/config/env.js';

const scalar = z.union([z.string(), z.number(), z.null()]);
const weatherSlotSchema = z.object({
  datetime: scalar.optional(),
  t: scalar.optional(),
  hu: scalar.optional(),
  weather_desc: scalar.optional(),
  weather_desc_en: scalar.optional(),
  wd: scalar.optional(),
  ws: scalar.optional(),
  tcc: scalar.optional(),
}).passthrough();
const weatherGroupSchema = z.array(weatherSlotSchema);
const regionSchema = z.object({
  cuaca: z.array(z.union([weatherSlotSchema, weatherGroupSchema])),
}).passthrough();

// ASUMSI — verifikasi §13a.1.3-4: this follows the commonly published BMKG
// per-region response shape and must be checked against the live API.
export const bmkgResponseSchema = z.object({
  data: z.array(regionSchema),
}).passthrough();

export type RawBmkgResponse = z.infer<typeof bmkgResponseSchema>;
export type RawResponseLogger = (entry: {
  locationCode: string;
  status: number | 'network_error' | 'timeout';
  body: unknown;
}) => void;
export type ApiResponseRecorder = (entry: {
  locationCode: string;
  requestUrl: string;
  status: number | null;
  body: unknown;
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  durationMs: number;
}) => Promise<void> | void;

export type BmkgErrorCode =
  | 'BMKG_NOT_CONFIGURED'
  | 'BMKG_TIMEOUT'
  | 'BMKG_NETWORK_ERROR'
  | 'BMKG_HTTP_ERROR'
  | 'BMKG_RATE_LIMIT_EXCEEDED'
  | 'BMKG_SCHEMA_VALIDATION_FAILED';

export class BmkgError extends Error {
  constructor(
    public readonly code: BmkgErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'BmkgError';
  }
}

export interface BmkgClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  rateLimitPerMinute?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  logger?: RawResponseLogger;
  responseRecorder?: ApiResponseRecorder;
  now?: () => number;
}

export class BmkgClient {
  private readonly requestTimes: number[] = [];
  private readonly options: {
    timeoutMs: number;
    maxRetries: number;
    rateLimitPerMinute: number;
    sleep: (ms: number) => Promise<void>;
    now: () => number;
  };
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string | undefined;
  private readonly logger: RawResponseLogger;
  private readonly responseRecorder?: ApiResponseRecorder;

  constructor(options: BmkgClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? env.BMKG_BASE_URL;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.logger = options.logger ?? ((entry) => {
      console.log(JSON.stringify({ level: 'info', event: 'bmkg_raw_response', ...entry }));
    });
    this.responseRecorder = options.responseRecorder;
    this.options = {
      timeoutMs: options.timeoutMs ?? env.BMKG_TIMEOUT_MS,
      maxRetries: options.maxRetries ?? 2,
      rateLimitPerMinute: options.rateLimitPerMinute ?? env.BMKG_RATE_LIMIT_PER_MIN,
      sleep: options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
      now: options.now ?? Date.now,
    };
  }

  async fetchForecast(locationCode: string): Promise<RawBmkgResponse> {
    if (!this.baseUrl) {
      throw new BmkgError('BMKG_NOT_CONFIGURED', 'BMKG_BASE_URL is required to fetch forecasts');
    }
    this.takeRateLimitToken();
    const url = new URL(locationCode, this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`);
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.options.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.options.timeoutMs);
      try {
        const startedAt = this.options.now();
        const response = await this.fetchImpl(url, { signal: controller.signal });
        const text = await response.text();
        let body: unknown = text;
        try { body = JSON.parse(text); } catch { /* raw text is retained for forensics */ }
        this.logger({ locationCode, status: response.status, body });
        if (!response.ok) {
          await this.responseRecorder?.({
            locationCode, requestUrl: url.toString(), status: response.status, body,
            success: false, errorCode: 'BMKG_HTTP_ERROR',
            errorMessage: `BMKG returned HTTP ${response.status}`,
            durationMs: Math.max(0, this.options.now() - startedAt),
          });
          lastError = new BmkgError('BMKG_HTTP_ERROR', `BMKG returned HTTP ${response.status}`, body);
          if (response.status < 500) throw lastError;
          if (attempt < this.options.maxRetries) await this.backoff(attempt);
          continue;
        }
        const parsed = bmkgResponseSchema.safeParse(body);
        if (!parsed.success) {
          await this.responseRecorder?.({
            locationCode, requestUrl: url.toString(), status: response.status, body,
            success: false, errorCode: 'BMKG_SCHEMA_VALIDATION_FAILED',
            errorMessage: 'BMKG response does not match the assumed schema',
            durationMs: Math.max(0, this.options.now() - startedAt),
          });
          alertSchemaValidationFailure(locationCode, parsed.error.issues);
          throw new BmkgError('BMKG_SCHEMA_VALIDATION_FAILED', 'BMKG response does not match the assumed schema', parsed.error.issues);
        }
        recordSchemaResult(true);
        await this.responseRecorder?.({
          locationCode, requestUrl: url.toString(), status: response.status, body,
          success: true, durationMs: Math.max(0, this.options.now() - startedAt),
        });
        return parsed.data;
      } catch (error) {
        if (error instanceof BmkgError) throw error;
        lastError = error;
        const timeout = error instanceof Error && error.name === 'AbortError';
        await this.responseRecorder?.({
          locationCode, requestUrl: url.toString(), status: null, body: String(error),
          success: false, errorCode: timeout ? 'BMKG_TIMEOUT' : 'BMKG_NETWORK_ERROR',
          errorMessage: 'BMKG request failed', durationMs: 0,
        });
        this.logger({ locationCode, status: timeout ? 'timeout' : 'network_error', body: String(error) });
        if (attempt < this.options.maxRetries) {
          await this.backoff(attempt);
          continue;
        }
        throw new BmkgError(timeout ? 'BMKG_TIMEOUT' : 'BMKG_NETWORK_ERROR', 'BMKG request failed', error);
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError instanceof BmkgError ? lastError : new BmkgError('BMKG_NETWORK_ERROR', 'BMKG request failed');
  }

  private takeRateLimitToken() {
    const now = this.options.now();
    while (this.requestTimes[0] !== undefined && this.requestTimes[0] <= now - 60_000) this.requestTimes.shift();
    if (this.requestTimes.length >= this.options.rateLimitPerMinute) {
      throw new BmkgError('BMKG_RATE_LIMIT_EXCEEDED', 'BMKG client rate limit exceeded');
    }
    this.requestTimes.push(now);
  }

  private async backoff(attempt: number) {
    await this.options.sleep(100 * 2 ** attempt);
  }
}

type Metric = { startedAt: number; total: number; failures: number };
let metric: Metric = { startedAt: Date.now(), total: 0, failures: 0 };
let bmkgHealthDegraded = false;

function recordSchemaResult(success: boolean) {
  const now = Date.now();
  if (now - metric.startedAt >= 15 * 60_000) metric = { startedAt: now, total: 0, failures: 0 };
  metric.total += 1;
  if (!success) metric.failures += 1;
  bmkgHealthDegraded = metric.total > 0 && (metric.failures / metric.total) * 100 > env.BMKG_SCHEMA_FAIL_THRESHOLD_PCT;
}

export function alertSchemaValidationFailure(locationCode: string, issues: unknown) {
  console.error(JSON.stringify({ level: 'error', event: 'bmkg_schema_validation_failed', locationCode, issues }));
  recordSchemaResult(false);
}

export function getBmkgHealthStatus() {
  return { bmkgHealthDegraded, schemaFailurePercentage: metric.total ? (metric.failures / metric.total) * 100 : 0 };
}