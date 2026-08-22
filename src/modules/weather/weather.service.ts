import { BmkgClient } from '../../infrastructure/bmkg/bmkg-client.js';
import type { BmkgErrorCode } from '../../infrastructure/bmkg/bmkg-client.js';
import { env } from '../../app/config/env.js';
import { getSourceUpdatedAt, normalizeForecast } from './weather.normalizer.js';
import {
  weatherSlotStore,
  weatherSnapshotStore,
  type WeatherSnapshot,
  type WeatherSnapshotRepository,
  type WeatherSlotRepository,
} from './weather.repository.js';
import type { CanonicalWeatherSlot } from './weather.types.js';

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
    let latest: WeatherSnapshot | null;
    try {
      latest = await this.options.snapshots.findLatestByLocation(locationCode);
    } catch (error) {
      throw new WeatherServiceError('WEATHER_CACHE_ERROR', 'Unable to read weather cache', error);
    }
    if (latest && this.isFresh(latest)) {
      console.log(JSON.stringify({ level: 'debug', event: 'weather_cache_hit', locationCode }));
      return this.asCanonical(latest.normalized_data);
    }
    console.log(JSON.stringify({ level: 'debug', event: 'weather_cache_miss', locationCode }));
    let raw;
    try {
      raw = await this.options.client.fetchForecast(locationCode);
    } catch (error) {
      const upstreamCode = error && typeof error === 'object' && 'code' in error
        && typeof error.code === 'string' ? error.code as BmkgErrorCode : null;
      throw new WeatherServiceError(
        upstreamCode ?? 'WEATHER_UPSTREAM_ERROR',
        'Unable to fetch weather from BMKG',
        error,
      );
    }
    const normalized = normalizeForecast(raw, locationCode);
    const sourceUpdatedAt = getSourceUpdatedAt(raw);
    let snapshot: WeatherSnapshot;
    try {
      snapshot = await this.options.snapshots.create({
        location_code: locationCode,
        source: 'BMKG',
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
    return normalized;
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

export function createWeatherService(client = new BmkgClient()) {
  return new WeatherService({ client, snapshots: weatherSnapshotStore, slots: weatherSlotStore });
}