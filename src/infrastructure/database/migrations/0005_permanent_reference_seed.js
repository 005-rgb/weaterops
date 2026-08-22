/**
 * Durable reference data. This migration is committed to the repository so a
 * fresh database on another Replit account can recreate the same baseline.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export function up(pgm) {
  pgm.sql(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_activities_profile_unique
      ON activities(activity_profile_code);

    INSERT INTO activity_profiles (code, version, name_id, name_en, hazard_sensitivity)
    VALUES ('CONCRETE_POUR', 1, 'Pengecoran Beton', 'Concrete Pour', '{}')
    ON CONFLICT (code, version) DO UPDATE SET
      name_id = EXCLUDED.name_id,
      name_en = EXCLUDED.name_en,
      hazard_sensitivity = EXCLUDED.hazard_sensitivity,
      active = true;

    INSERT INTO activities (activity_profile_code, name_id, name_en)
    VALUES ('CONCRETE_POUR', 'Pengecoran Beton', 'Concrete Pour')
    ON CONFLICT (activity_profile_code) DO UPDATE SET
      name_id = EXCLUDED.name_id,
      name_en = EXCLUDED.name_en,
      active = true;
  `);
}

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export function down(pgm) {
  pgm.sql(`
    DELETE FROM activities WHERE activity_profile_code = 'CONCRETE_POUR';
    DELETE FROM activity_profiles WHERE code = 'CONCRETE_POUR' AND version = 1;
    DROP INDEX IF EXISTS idx_activities_profile_unique;
  `);
}