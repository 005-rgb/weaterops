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

export const weatherSnapshotsRepository: Repository<WeatherSnapshot> = createRepository(
  'weather_snapshots',
  ['location_code', 'source', 'raw_response', 'normalized_data', 'source_updated_at', 'fetched_at'],
);
export const weatherSlotsRepository: Repository<WeatherSlot> = createRepository(
  'weather_slots',
  ['weather_snapshot_id', 'location_code', 'local_datetime', 'weather_desc', 'hazard_score', 'raw_fields'],
);