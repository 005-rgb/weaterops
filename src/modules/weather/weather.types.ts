// ASUMSI — verifikasi §13a.1: these are the documented BMKG descriptions
// currently known to this adapter; live values must be confirmed before go-live.
export type WeatherDescCode =
  | 'CERAH'
  | 'CERAH_BERAWAN'
  | 'BERAWAN'
  | 'BERAWAN_TEBAL'
  | 'HUJAN_RINGAN'
  | 'HUJAN_SEDANG'
  | 'HUJAN_LEBAT'
  | 'HUJAN_PETIR'
  | 'HUJAN_LOKAL'
  | 'KABUT'
  | 'ASAP'
  | 'UDARA_KABUR';

export interface CanonicalWeatherSlot {
  locationCode: string;
  // ASUMSI — verifikasi §13a.1.3: BMKG datetime without an offset is treated as WIB.
  localDatetime: string | null;
  weatherDesc: string | null;
  weatherDescNormalized: WeatherDescCode | 'UNKNOWN';
  temperatureC: number | null;
  humidityPct: number | null;
  windSpeedMs: number | null;
  windDirection: string | null;
  cloudCoverPct: number | null;
}

export function normalizeWeatherDesc(raw: string): WeatherDescCode | 'UNKNOWN' {
  const value = raw.trim().toLocaleLowerCase('id-ID');
  const mapping: Record<string, WeatherDescCode> = {
    cerah: 'CERAH',
    'cerah berawan': 'CERAH_BERAWAN',
    berawan: 'BERAWAN',
    'berawan tebal': 'BERAWAN_TEBAL',
    'hujan ringan': 'HUJAN_RINGAN',
    'hujan sedang': 'HUJAN_SEDANG',
    'hujan lebat': 'HUJAN_LEBAT',
    'hujan petir': 'HUJAN_PETIR',
    'hujan lokal': 'HUJAN_LOKAL',
    kabut: 'KABUT',
    asap: 'ASAP',
    'udara kabur': 'UDARA_KABUR',
  };
  return mapping[value] ?? 'UNKNOWN';
}