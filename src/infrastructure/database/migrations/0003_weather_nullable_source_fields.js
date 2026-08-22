/**
 * Weather source fields may be absent in an upstream response.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export function up(pgm) {
  pgm.sql(`
    ALTER TABLE weather_slots
      ALTER COLUMN local_datetime DROP NOT NULL,
      ALTER COLUMN weather_desc DROP NOT NULL;
  `);
}

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export function down(pgm) {
  pgm.sql(`
    ALTER TABLE weather_slots
      ALTER COLUMN local_datetime SET NOT NULL,
      ALTER COLUMN weather_desc SET NOT NULL;
  `);
}