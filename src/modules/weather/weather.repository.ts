import { pool, withTransaction } from '../../infrastructure/database/client.js';
import type { PoolClient } from 'pg';
import { createRepository, type Repository } from '../../infrastructure/database/repository.js';

export interface WeatherSnapshot {
  id: string; location_code: string; source: string; raw_response: unknown;
  normalized_data: unknown; source_updated_at: Date | null; fetched_at: Date;
  created_at: Date; expires_at: Date;
}
export interface WeatherSlot {
  id: string; weather_snapshot_id: string; location_code: string; local_datetime: Date;
  weather_desc: string; hazard_score: number; raw_fields: unknown; created_at: Date; expires_at: Date;
}

export interface WeatherApiResponse {
  id: string;
  source_code: string;
  location_code: string | null;
  request_url: string | null;
  request_params: unknown;
  http_status: number | null;
  response_body: unknown;
  response_text: string | null;
  success: boolean;
  error_code: string | null;
  error_message: string | null;
  duration_ms: number | null;
  fetched_at: Date;
  expires_at: Date | null;
}

export const weatherSnapshotsRepository: Repository<WeatherSnapshot> = createRepository(
  'weather_snapshots',
  ['location_code', 'source', 'raw_response', 'normalized_data', 'source_updated_at', 'fetched_at'],
);
export const weatherSlotsRepository: Repository<WeatherSlot> = createRepository(
  'weather_slots',
  ['weather_snapshot_id', 'location_code', 'local_datetime', 'weather_desc', 'hazard_score', 'raw_fields'],
);
export const weatherApiResponsesRepository: Repository<WeatherApiResponse> = createRepository(
  'weather_api_responses',
  [
    'source_code', 'location_code', 'request_url', 'request_params', 'http_status',
    'response_body', 'response_text', 'success', 'error_code', 'error_message', 'duration_ms',
  ],
);

export interface WeatherSnapshotRepository {
  findLatestByLocation(locationCode: string): Promise<WeatherSnapshot | null>;
  create(data: Partial<WeatherSnapshot>): Promise<WeatherSnapshot>;
  createWithSlots?(data: Partial<WeatherSnapshot>, slots: Array<Partial<WeatherSlot>>): Promise<WeatherSnapshot>;
}

export interface WeatherSlotRepository {
  create(data: Partial<WeatherSlot>): Promise<WeatherSlot>;
}

export interface WeatherApiResponseRepository {
  create(data: Partial<WeatherApiResponse>): Promise<WeatherApiResponse>;
}

export interface WeatherSource {
  id: string;
  code: string;
  provider_type: 'domestic' | 'international';
  display_name: string;
  adapter_key: string;
  base_url: string | null;
  config: unknown;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export const weatherSourcesRepository = createRepository<WeatherSource>(
  'weather_sources',
  ['code', 'provider_type', 'display_name', 'adapter_key', 'base_url', 'config', 'enabled'],
);

export const weatherSnapshotStore: WeatherSnapshotRepository = {
  async findLatestByLocation(locationCode) {
    const result = await pool.query(
      'SELECT * FROM weather_snapshots WHERE location_code = $1 AND expires_at > now() ORDER BY fetched_at DESC LIMIT 1',
      [locationCode],
    );
    return (result.rows[0] as WeatherSnapshot | undefined) ?? null;
  },
  create: (data) => weatherSnapshotsRepository.create(data),
  async createWithSlots(data, slots) {
    return withTransaction(async (client) => {
      const snapshot = await insertSnapshot(client, data);
      for (const slot of slots) await insertSlot(client, { ...slot, weather_snapshot_id: snapshot.id });
      return snapshot;
    });
  },
};

export const weatherSlotStore: WeatherSlotRepository = {
  create: (data) => weatherSlotsRepository.create(data),
};

export const weatherApiResponseStore: WeatherApiResponseRepository = {
  create: (data) => weatherApiResponsesRepository.create(data),
};

async function insertSnapshot(client: PoolClient, data: Partial<WeatherSnapshot>): Promise<WeatherSnapshot> {
  const result = await client.query<WeatherSnapshot>(
    `INSERT INTO weather_snapshots
      (location_code, source, raw_response, normalized_data, source_updated_at, fetched_at)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, now())) RETURNING *`,
    [data.location_code, data.source ?? 'BMKG', data.raw_response, data.normalized_data,
      data.source_updated_at ?? null, data.fetched_at ?? null],
  );
  return result.rows[0];
}

async function insertSlot(client: PoolClient, data: Partial<WeatherSlot>): Promise<WeatherSlot> {
  const result = await client.query<WeatherSlot>(
    `INSERT INTO weather_slots
      (weather_snapshot_id, location_code, local_datetime, weather_desc, hazard_score, raw_fields)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [data.weather_snapshot_id, data.location_code, data.local_datetime, data.weather_desc ?? '',
      data.hazard_score ?? 0, data.raw_fields],
  );
  return result.rows[0];
}