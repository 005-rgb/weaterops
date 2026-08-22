/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export function up(pgm) {
  pgm.sql('CREATE UNIQUE INDEX IF NOT EXISTS idx_session_boards_session_key_unique ON session_boards(session_key_hash);');
}
/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export function down(pgm) {
  pgm.sql('DROP INDEX IF EXISTS idx_session_boards_session_key_unique;');
}