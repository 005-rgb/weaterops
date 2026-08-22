/**
 * API history is permanent by default. Cache freshness remains controlled by
 * weather_snapshots.fetched_at and WEATHER_FRESHNESS_MINUTES.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export function up(pgm) {
  pgm.sql(`
    ALTER TABLE weather_api_responses
      ALTER COLUMN expires_at DROP NOT NULL,
      ALTER COLUMN expires_at DROP DEFAULT;
    UPDATE weather_api_responses SET expires_at = NULL;
  `);
}

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export function down(pgm) {
  pgm.sql(`
    ALTER TABLE weather_api_responses
      ALTER COLUMN expires_at SET DEFAULT weatherops_expires_at(),
      ALTER COLUMN expires_at SET NOT NULL;
  `);
}