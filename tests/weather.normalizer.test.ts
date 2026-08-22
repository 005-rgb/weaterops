import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

import { bmkgResponseSchema } from '../src/infrastructure/bmkg/bmkg-client.js';
import { normalizeForecast } from '../src/modules/weather/weather.normalizer.js';
import { normalizeWeatherDesc } from '../src/modules/weather/weather.types.js';

describe('weather normalizer', () => {
  it('normalizes the assumed documented BMKG fixture and uses null for missing values', async () => {
    const fixture = JSON.parse(await readFile(new URL('./fixtures/bmkg-response.assumed-format.json', import.meta.url), 'utf8'));
    const parsed = bmkgResponseSchema.parse(fixture);
    const result = normalizeForecast(parsed, 'DUMMY-KEL-1');
    expect(result[0]).toMatchObject({
      locationCode: 'DUMMY-KEL-1',
      localDatetime: '2026-08-22T10:00:00+07:00',
      weatherDesc: 'Cerah Berawan',
      weatherDescNormalized: 'CERAH_BERAWAN',
      temperatureC: 31,
      humidityPct: 70,
      windSpeedMs: 10,
    });
    expect(result[1]).toMatchObject({
      temperatureC: null,
      humidityPct: null,
      windSpeedMs: null,
      windDirection: null,
      cloudCoverPct: null,
      weatherDescNormalized: 'UNKNOWN',
    });
  });

  it('does not guess unknown descriptions', () => {
    expect(normalizeWeatherDesc('Nilai Baru BMKG')).toBe('UNKNOWN');
  });

  it('rejects a response that is not the assumed BMKG shape', () => {
    expect(bmkgResponseSchema.safeParse({ data: [{ cuaca: 'invalid' }] }).success).toBe(false);
  });
});