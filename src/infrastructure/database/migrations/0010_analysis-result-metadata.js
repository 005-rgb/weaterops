/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export function up(pgm) {
  pgm.sql(`
    ALTER TABLE analysis_results
      ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}';
  `);
}

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export function down(pgm) {
  pgm.sql('ALTER TABLE analysis_results DROP COLUMN IF EXISTS metadata;');
}