import { describe, expect, it, vi } from 'vitest';

import { WeatherService } from '../src/modules/weather/weather.service.js';
import type { WeatherSnapshot } from '../src/modules/weather/weather.repository.js';

const slots = [{ locationCode: 'ABC', localDatetime: '2026-08-22T10:00:00+07:00', weatherDesc: 'Cerah', weatherDescNormalized: 'CERAH' as const, temperatureC: 30, humidityPct: null, windSpeedMs: null, windDirection: null, cloudCoverPct: null }];
const snapshot = (data = slots): WeatherSnapshot => ({
  id: 'snapshot-1', location_code: 'ABC', source: 'BMKG', raw_response: {},
  normalized_data: data, source_updated_at: null, fetched_at: new Date('2026-08-22T09:00:00Z'),
  created_at: new Date('2026-08-22T09:00:00Z'), expires_at: new Date('2026-08-29T09:00:00Z'),
});
const raw = { data: [{ cuaca: [[{ datetime: '2026-08-22T10:00:00+07:00', weather_desc: 'Cerah', t: 30 }]] }] };

function service(latest: WeatherSnapshot | null, fetchForecast = vi.fn().mockResolvedValue(raw)) {
  return {
    fetchForecast,
    instance: new WeatherService({
      client: { fetchForecast },
      snapshots: {
        findLatestByLocation: vi.fn().mockResolvedValue(latest),
        create: vi.fn().mockResolvedValue(snapshot()),
      },
      slots: { create: vi.fn().mockResolvedValue({}) },
      freshnessMinutes: 60,
      now: () => new Date('2026-08-22T09:30:00Z'),
    }),
  };
}

describe('weather service cache paths', () => {
  it('serves a fresh cache hit without calling BMKG', async () => {
    const setup = service(snapshot());
    await expect(setup.instance.getForecastForLocation('ABC')).resolves.toEqual(slots);
    expect(setup.fetchForecast).not.toHaveBeenCalled();
  });

  it('fetches and persists on cache miss', async () => {
    const setup = service(null);
    await setup.instance.getForecastForLocation('ABC');
    expect(setup.fetchForecast).toHaveBeenCalledWith('ABC');
  });

  it('fetches when the latest snapshot is expired', async () => {
    const setup = service({ ...snapshot(), fetched_at: new Date('2026-08-22T07:00:00Z') });
    await setup.instance.getForecastForLocation('ABC');
    expect(setup.fetchForecast).toHaveBeenCalledTimes(1);
  });
});