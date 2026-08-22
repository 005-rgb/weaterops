import type { QueryResultRow } from 'pg';
import { pool } from '../../infrastructure/database/client.js';

export type LocationLevel = 'adm1' | 'adm2' | 'adm3' | 'adm4';

export interface LocationRow extends QueryResultRow {
  code: string;
  parentCode: string | null;
  level: LocationLevel;
  name: string;
  fullName: string;
}

export async function resolvePoint(lat: number, lng: number): Promise<LocationRow | undefined> {
  for (const level of ['adm4', 'adm3', 'adm2', 'adm1'] as const) {
    const result = await pool.query<LocationRow>(
      `SELECT code, parent_code AS "parentCode", level, name, full_name AS "fullName"
       FROM locations
       WHERE active = true AND level = $1 AND geometry IS NOT NULL
         AND ST_Contains(geometry, ST_SetSRID(ST_MakePoint($2, $3), 4326))
       ORDER BY ST_Area(geometry) ASC LIMIT 1`,
      [level, lng, lat],
    );
    if (result.rows[0]) return result.rows[0];
  }
  return undefined;
}

export async function getBoundary(code: string, tolerance: number) {
  const result = await pool.query<{
    code: string; name: string; fullName: string; level: LocationLevel;
    boundarySource: string | null; geojson: string | null;
  }>(
    `WITH candidate AS (
       SELECT code, name, full_name AS "fullName", level, boundary_source AS "boundarySource",
              geometry, geometry_simplified
       FROM locations WHERE code = $1 AND active = true AND level = 'adm4'
     ), cached AS (
       SELECT *, geometry_simplified AS selected_geometry FROM candidate
     ), generated AS (
       SELECT *, ST_SimplifyPreserveTopology(geometry, $2) AS generated_geometry
       FROM cached WHERE selected_geometry IS NULL AND geometry IS NOT NULL
     )
     SELECT code, name, "fullName", level, "boundarySource",
            ST_AsGeoJSON(COALESCE(selected_geometry, generated_geometry)) AS geojson
     FROM generated
     UNION ALL
     SELECT code, name, "fullName", level, "boundarySource",
            ST_AsGeoJSON(selected_geometry) AS geojson
     FROM cached WHERE selected_geometry IS NOT NULL`,
    [code, tolerance],
  );
  const row = result.rows[0];
  if (row?.geojson && !row.geojson.includes('null')) {
    if (!row.boundarySource) {
      // Boundary provenance is intentionally preserved when present; no inferred
      // national coverage is claimed by this development sample.
    }
    if (row.geojson) {
      await pool.query(
        `UPDATE locations SET geometry_simplified = ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)
         WHERE code = $2 AND geometry_simplified IS NULL`,
        [row.geojson, code],
      );
    }
    return { ...row, geojson: JSON.parse(row.geojson) as unknown };
  }
  return undefined;
}

export async function searchLocations(query: string, viewportLat?: number, viewportLng?: number) {
  const result = await pool.query<LocationRow & { matchRank: number; distance: number | null }>(
    `SELECT code, parent_code AS "parentCode", level, name, full_name AS "fullName",
       CASE WHEN name ILIKE $1 OR full_name ILIKE $1 THEN 0 ELSE 1 END AS "matchRank",
       CASE WHEN $3::double precision IS NULL THEN NULL
         ELSE ST_Distance(geometry::geography,
           ST_SetSRID(ST_MakePoint($3, $2),4326)::geography) END AS distance
     FROM locations
     WHERE active = true AND (name ILIKE $4 OR full_name ILIKE $4)
     ORDER BY CASE level WHEN 'adm4' THEN 0 WHEN 'adm3' THEN 1 WHEN 'adm2' THEN 2 ELSE 3 END,
              "matchRank", distance NULLS LAST, name
     LIMIT 10`,
    [`${query}%`, viewportLat ?? null, viewportLng ?? null, `%${query}%`],
  );
  return result.rows;
}

export async function listLocations(level: LocationLevel, parentCode?: string) {
  const result = await pool.query<LocationRow>(
    `SELECT code, parent_code AS "parentCode", level, name, full_name AS "fullName"
     FROM locations WHERE active = true AND level = $1
       AND ($2::text IS NULL OR parent_code = $2)
     ORDER BY name LIMIT 1000`,
    [level, parentCode ?? null],
  );
  return result.rows;
}

export async function getHazardHeatmap(bounds: [number, number, number, number]) {
  const [west, south, east, north] = bounds;
  const result = await pool.query<{
    code: string; name: string; hazardScore: number; latitude: number; longitude: number;
  }>(
    `SELECT l.code, l.name, AVG(ws.hazard_score)::float AS "hazardScore",
       ST_Y(ST_PointOnSurface(l.geometry)) AS latitude,
       ST_X(ST_PointOnSurface(l.geometry)) AS longitude
     FROM locations l JOIN weather_slots ws ON ws.location_code = l.code
     WHERE l.level = 'adm4' AND l.geometry IS NOT NULL
       AND l.geometry && ST_MakeEnvelope($1,$2,$3,$4,4326)
     GROUP BY l.code, l.name, l.geometry ORDER BY l.code`,
    [west, south, east, north],
  );
  return result.rows;
}