import { createRepository, type Repository } from '../../infrastructure/database/repository.js';

export interface ActivityProfile {
  id: string; code: string; version: number; name_id: string; name_en: string;
  hazard_sensitivity: Record<string, unknown>; active: boolean; created_at: Date;
}
export interface Activity {
  id: string; activity_profile_code: string; name_id: string; name_en: string;
  active: boolean; created_at: Date;
}

export const activityProfilesRepository: Repository<ActivityProfile> = createRepository(
  'activity_profiles',
  ['code', 'version', 'name_id', 'name_en', 'hazard_sensitivity', 'active'],
);
export const activitiesRepository: Repository<Activity> = createRepository(
  'activities',
  ['activity_profile_code', 'name_id', 'name_en', 'active'],
);