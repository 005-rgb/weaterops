/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export function up(pgm) {
  pgm.sql('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
}

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export function down(pgm) {
  pgm.sql('DROP EXTENSION IF EXISTS pgcrypto;');
}