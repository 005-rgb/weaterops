/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export function up(pgm) {
  pgm.sql(`INSERT INTO translation_catalog (code, locale, template, reviewed_by_human) VALUES
    ('SESSION_BOARD_SUMMARY_HIGH_RISK','id','{highRisk} dari {total} proyek Anda berisiko tinggi minggu ini',false),
    ('SESSION_BOARD_SUMMARY_HIGH_RISK','en','{highRisk} of your {total} projects are high risk this week',false)
    ON CONFLICT (code, locale) DO UPDATE SET template = EXCLUDED.template;`);
}
/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export function down(pgm) { pgm.sql(`DELETE FROM translation_catalog WHERE code = 'SESSION_BOARD_SUMMARY_HIGH_RISK';`); }