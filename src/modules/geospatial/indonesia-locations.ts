import type { LocationLevel, LocationRow } from './geospatial.repository.js';

type ApiLocation = { id: string; name: string };
const cache = new Map<string, { expiresAt: number; rows: LocationRow[] }>();
const CACHE_TTL_MS = 30 * 60_000;
const BASE_URL = 'https://www.emsifa.com/api-wilayah-indonesia/api';

const endpointByLevel: Record<LocationLevel, (parent?: string) => string> = {
  adm1: () => 'provinces.json',
  adm2: (parent) => `regencies/${encodeURIComponent(parent ?? '')}.json`,
  adm3: (parent) => `districts/${encodeURIComponent(parent ?? '')}.json`,
  adm4: (parent) => `villages/${encodeURIComponent(parent ?? '')}.json`,
};

export async function fetchIndonesiaLocations(level: LocationLevel, parentCode?: string): Promise<LocationRow[]> {
  if (level !== 'adm1' && !parentCode) return [];
  const key = `${level}:${parentCode ?? ''}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.rows;

  const response = await fetch(`${BASE_URL}/${endpointByLevel[level](parentCode)}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Indonesia location catalog returned HTTP ${response.status}`);
  const body = await response.json() as unknown;
  if (!Array.isArray(body)) throw new Error('Indonesia location catalog returned an invalid response');

  const rows = (body as ApiLocation[]).filter((item) => item && typeof item.id === 'string' && typeof item.name === 'string')
    .map((item) => ({
      id: item.id,
      code: item.id,
      parentCode: parentCode ?? null,
      level,
      name: item.name,
      fullName: item.name,
    }));
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, rows });
  return rows;
}