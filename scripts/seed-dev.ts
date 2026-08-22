import { pool } from '../src/infrastructure/database/client.js';

const locations = [
  ['DUMMY-PROV', null, 'adm1', 'Provinsi Dummy', 'Provinsi Dummy', [-0.02, -0.02, 0.02, 0.02]],
  ['DUMMY-KAB', 'DUMMY-PROV', 'adm2', 'Kabupaten Dummy', 'Kabupaten Dummy, Provinsi Dummy', [-0.02, -0.02, 0.02, 0.02]],
  ['DUMMY-KEC', 'DUMMY-KAB', 'adm3', 'Kecamatan Dummy', 'Kecamatan Dummy, Kabupaten Dummy, Provinsi Dummy', [-0.02, -0.02, 0.02, 0.02]],
  ['DUMMY-KEL-1', 'DUMMY-KEC', 'adm4', 'Kelurahan Barat', 'Kelurahan Barat, Kecamatan Dummy, Kabupaten Dummy, Provinsi Dummy', [-0.02, -0.02, 0, 0.02]],
  ['DUMMY-KEL-2', 'DUMMY-KEC', 'adm4', 'Kelurahan Timur', 'Kelurahan Timur, Kecamatan Dummy, Kabupaten Dummy, Provinsi Dummy', [0, -0.02, 0.02, 0.02]],
] as const;

function polygon([minLng, minLat, maxLng, maxLat]: readonly number[]) {
  return JSON.stringify({
    type: 'MultiPolygon',
    coordinates: [[[
      [minLng, minLat], [maxLng, minLat], [maxLng, maxLat],
      [minLng, maxLat], [minLng, minLat],
    ]]],
  });
}

try {
  await pool.query('BEGIN');
  for (const [code, parentCode, level, name, fullName, bounds] of locations) {
    await pool.query(
      `INSERT INTO locations (code, parent_code, level, name, full_name, geometry, geometry_simplified, boundary_source)
       VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_GeomFromGeoJSON($6), 4326),
               ST_SetSRID(ST_GeomFromGeoJSON($6), 4326), 'weatherops-dev-seed')
       ON CONFLICT (code) DO UPDATE SET parent_code = EXCLUDED.parent_code, level = EXCLUDED.level,
         name = EXCLUDED.name, full_name = EXCLUDED.full_name, geometry = EXCLUDED.geometry,
         geometry_simplified = EXCLUDED.geometry_simplified, boundary_source = EXCLUDED.boundary_source`,
      [code, parentCode, level, name, fullName, polygon(bounds)],
    );
  }
  const profile = await pool.query<{ id: string }>(
    `INSERT INTO activity_profiles (code, version, name_id, name_en, hazard_sensitivity)
     VALUES ('CONCRETE_POUR', 1, 'Pengecoran Beton', 'Concrete Pour', '{}')
     ON CONFLICT (code, version) DO UPDATE SET name_id = EXCLUDED.name_id, name_en = EXCLUDED.name_en
     RETURNING id`,
  );
  await pool.query(
    `INSERT INTO activities (activity_profile_code, name_id, name_en)
      VALUES ('CONCRETE_POUR', 'Pengecoran Beton', 'Concrete Pour')
      ON CONFLICT (activity_profile_code) DO UPDATE SET
        name_id = EXCLUDED.name_id,
        name_en = EXCLUDED.name_en,
        active = true`,
  );
  await pool.query('COMMIT');
  console.log(JSON.stringify({ level: 'info', event: 'dev_seed_complete', profile_id: profile.rows[0]?.id }));
} catch (error) {
  await pool.query('ROLLBACK');
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}