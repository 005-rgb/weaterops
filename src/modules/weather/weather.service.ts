import { BmkgClient } from '../../infrastructure/bmkg/bmkg-client.js';
import type { BmkgErrorCode } from '../../infrastructure/bmkg/bmkg-client.js';
import { env } from '../../app/config/env.js';
import { getSourceUpdatedAt, normalizeForecast } from './weather.normalizer.js';
import {
  weatherSlotStore,
  weatherSnapshotStore,
  weatherApiResponseStore,
  type WeatherSnapshot,
  type WeatherApiResponseRepository,
  type WeatherSnapshotRepository,
  type WeatherSlotRepository,
} from './weather.repository.js';
import type { CanonicalWeatherSlot } from './weather.types.js';
import { withSpan } from '../../infrastructure/tracing/setup.js';

export type WeatherServiceErrorCode =
  | 'WEATHER_NOT_CONFIGURED'
  | 'WEATHER_CACHE_ERROR'
  | 'WEATHER_UPSTREAM_ERROR'
  | BmkgErrorCode;

export class WeatherServiceError extends Error {
  constructor(public readonly code: WeatherServiceErrorCode, message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'WeatherServiceError';
  }
}

export interface WeatherServiceOptions {
  client: Pick<BmkgClient, 'fetchForecast'>;
  snapshots: WeatherSnapshotRepository;
  slots: WeatherSlotRepository;
  apiResponses?: WeatherApiResponseRepository;
  sourceCode?: string;
  freshnessMinutes?: number;
  now?: () => Date;
}

export class WeatherService {
  private readonly freshnessMinutes: number;
  private readonly now: () => Date;

  constructor(private readonly options: WeatherServiceOptions) {
    this.freshnessMinutes = options.freshnessMinutes ?? env.WEATHER_FRESHNESS_MINUTES;
    this.now = options.now ?? (() => new Date());
  }

  async getForecastForLocation(locationCode: string): Promise<CanonicalWeatherSlot[]> {
    const result = await this.getForecastWithSnapshot(locationCode);
    return result.slots;
  }

  async getForecastWithSnapshot(locationCode: string): Promise<{
    slots: CanonicalWeatherSlot[];
    weatherSnapshotId: string;
  }> {
    let latest: WeatherSnapshot | null;
    try {
      latest = await withSpan('cache.lookup', { attributes: { 'location.code': locationCode } }, async (span) => {
        const value = await this.options.snapshots.findLatestByLocation(locationCode);
        span.setAttribute('cache.hit', Boolean(value && this.isFresh(value)));
        return value;
      });
    } catch (error) {
      throw new WeatherServiceError('WEATHER_CACHE_ERROR', 'Unable to read weather cache', error);
    }
    if (latest && this.isFresh(latest)) {
      console.log(JSON.stringify({ level: 'debug', event: 'weather_cache_hit', locationCode }));
      return { slots: this.asCanonical(latest.normalized_data), weatherSnapshotId: latest.id };
    }
    console.log(JSON.stringify({ level: 'debug', event: 'weather_cache_miss', locationCode }));
    let raw;
    try {
      raw = await withSpan('bmkg.fetch', { attributes: { 'location.code': locationCode } }, async (span) => {
        try {
          const value = await this.options.client.fetchForecast(locationCode);
          span.setAttribute('bmkg.status_code', 200);
          span.setAttribute('bmkg.retry_count', 0);
          return value;
        } catch (error) {
          span.setAttribute('bmkg.status_code', 503);
          span.setAttribute('bmkg.retry_count', 2);
          throw error;
        }
      });
    } catch (error) {
      const upstreamCode = error && typeof error === 'object' && 'code' in error
        && typeof error.code === 'string' ? error.code as BmkgErrorCode : null;
      throw new WeatherServiceError(
        upstreamCode ?? 'WEATHER_UPSTREAM_ERROR',
        'Unable to fetch weather from BMKG',
        error,
      );
    }
    const normalized = await withSpan('weather.normalize', { attributes: { 'location.code': locationCode } },
      () => normalizeForecast(raw, locationCode));
    const sourceUpdatedAt = getSourceUpdatedAt(raw);
    let snapshot: WeatherSnapshot;
    try {
      snapshot = await this.options.snapshots.create({
        location_code: locationCode,
        source: this.options.sourceCode ?? 'BMKG',
        raw_response: raw,
        normalized_data: normalized,
        source_updated_at: sourceUpdatedAt,
      });
      await Promise.all(normalized.flatMap((slot) => {
        if (slot.localDatetime === null) return [];
        return [this.options.slots.create({
          weather_snapshot_id: snapshot.id,
          location_code: slot.locationCode,
          local_datetime: new Date(slot.localDatetime),
          weather_desc: slot.weatherDesc ?? '',
          // This column predates the decision engine; 0 is neutral storage, not a decision.
          hazard_score: 0,
          raw_fields: slot,
        })];
      }));
    } catch (error) {
      throw new WeatherServiceError('WEATHER_CACHE_ERROR', 'Unable to persist weather snapshot', error);
    }
    return { slots: normalized, weatherSnapshotId: snapshot.id };
  }

  private isFresh(snapshot: WeatherSnapshot): boolean {
    const now = this.now().getTime();
    const threshold = this.freshnessMinutes * 60_000;
    const fetched = new Date(snapshot.fetched_at).getTime();
    const sourceUpdated = snapshot.source_updated_at ? new Date(snapshot.source_updated_at).getTime() : null;
    return Number.isFinite(fetched) && now - fetched < threshold
      && (sourceUpdated === null || (Number.isFinite(sourceUpdated) && now - sourceUpdated < threshold));
  }

  private asCanonical(value: unknown): CanonicalWeatherSlot[] {
    return Array.isArray(value) ? value as CanonicalWeatherSlot[] : [];
  }
}

export function createWeatherService(client?: BmkgClient) {
  const recordingClient = client ?? new BmkgClient({
    responseRecorder: (entry) => weatherApiResponseStore.create({
        source_code: 'BMKG',
        location_code: entry.locationCode,
        request_url: entry.requestUrl,
        http_status: entry.status,
        response_body: typeof entry.body === 'object' ? entry.body : null,
        response_text: typeof entry.body === 'string' ? entry.body : null,
        success: entry.success,
        error_code: entry.errorCode ?? null,
        error_message: entry.errorMessage ?? null,
        duration_ms: entry.durationMs,
      }).then(() => undefined),
  });
  return new WeatherService({
    client: recordingClient,
    snapshots: weatherSnapshotStore,
    slots: weatherSlotStore,
    apiResponses: weatherApiResponseStore,
    sourceCode: 'BMKG',
  });
}