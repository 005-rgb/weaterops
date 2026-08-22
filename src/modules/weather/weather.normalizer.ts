import type { RawBmkgResponse } from '../../infrastructure/bmkg/bmkg-client.js';
import type { CanonicalWeatherSlot } from './weather.types.js';
import { normalizeWeatherDesc } from './weather.types.js';

type RawSlot = Record<string, unknown>;

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function stringOrNull(value: unknown): string | null {
  return value === null || value === undefined || value === '' ? null : String(value);
}

function datetimeOrNull(value: unknown): string | null {
  const input = stringOrNull(value);
  if (!input) return null;
  // ASUMSI — verifikasi §13a.1.3: naive BMKG timestamps are treated as WIB (+07:00).
  const candidate = /(?:Z|[+-]\d{2}:\d{2})$/.test(input) ? input : `${input}+07:00`;
  const date = new Date(candidate);
  return Number.isNaN(date.valueOf()) ? null : candidate;
}

function flatten(groups: RawBmkgResponse['data'][number]['cuaca']): RawSlot[] {
  return groups.flatMap((item) => Array.isArray(item) ? item : [item]) as RawSlot[];
}

export function normalizeForecast(response: RawBmkgResponse, locationCode: string): CanonicalWeatherSlot[] {
  return response.data.flatMap((region) => flatten(region.cuaca).map((slot) => {
    const weatherDesc = stringOrNull(slot.weather_desc) ?? '';
    return {
      locationCode,
      localDatetime: datetimeOrNull(slot.datetime) ?? '',
      weatherDesc,
      weatherDescNormalized: weatherDesc ? normalizeWeatherDesc(weatherDesc) : 'UNKNOWN',
      temperatureC: numberOrNull(slot.t),
      humidityPct: numberOrNull(slot.hu),
      windSpeedMs: numberOrNull(slot.ws),
      windDirection: stringOrNull(slot.wd),
      cloudCoverPct: numberOrNull(slot.tcc),
    };
  }));
}

export function getSourceUpdatedAt(response: RawBmkgResponse): Date | null {
  const value = (response as Record<string, unknown>).source_updated_at
    ?? (response as Record<string, unknown>).updated_at;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date;
}