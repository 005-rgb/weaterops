import { createRepository, type Repository } from '../../infrastructure/database/repository.js';

export interface Location {
  id: string;
  code: string;
  parent_code: string | null;
  level: 'adm1' | 'adm2' | 'adm3' | 'adm4';
  name: string;
  full_name: string;
  active: boolean;
  geometry: unknown;
  geometry_simplified: unknown;
  boundary_source: string | null;
  created_at: Date;
  updated_at: Date;
}

export const locationsRepository: Repository<Location> = createRepository('locations', [
  'code', 'parent_code', 'level', 'name', 'full_name', 'active', 'geometry',
  'geometry_simplified', 'boundary_source',
]);