/**
 * Fase 5: bilingual translation catalog and immutable per-locale reports.
 *
 * The INSERTs are intentionally idempotent so db:bootstrap can be rerun safely.
 * reviewed_by_human stays false until a bilingual reviewer approves each entry.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export function up(pgm) {
  pgm.sql(`
    INSERT INTO translation_catalog (code, locale, template, reviewed_by_human) VALUES
      ('HEAVY_RAIN_CRITICAL_SLOT', 'id', 'Hujan lebat berada dalam waktu kerja.', false),
      ('HEAVY_RAIN_CRITICAL_SLOT', 'en', 'Heavy rain falls within the work window.', false),
      ('UNKNOWN_WEATHER_LOW_CONFIDENCE', 'id', 'Data cuaca tidak dikenal menurunkan tingkat keyakinan.', false),
      ('UNKNOWN_WEATHER_LOW_CONFIDENCE', 'en', 'Unknown weather data lowers confidence.', false),
      ('INCOMPLETE_SLOT_COVERAGE', 'id', 'Cakupan slot prakiraan tidak lengkap.', false),
      ('INCOMPLETE_SLOT_COVERAGE', 'en', 'Forecast slot coverage is incomplete.', false),
      ('CRITICAL_WINDOW_RAIN_RISK', 'id', 'Terdapat risiko hujan pada jendela kritis.', false),
      ('CRITICAL_WINDOW_RAIN_RISK', 'en', 'There is rain risk during the critical window.', false),
      ('CLEAR_CONDITIONS_PROCEED', 'id', 'Kondisi cuaca mendukung pelaksanaan.', false),
      ('CLEAR_CONDITIONS_PROCEED', 'en', 'Weather conditions support proceeding.', false),
      ('ALTERNATIVE_WINDOW_AVAILABLE', 'id', 'Tersedia jendela waktu alternatif.', false),
      ('ALTERNATIVE_WINDOW_AVAILABLE', 'en', 'An alternative time window is available.', false),
      ('status.PROCEED', 'id', 'Lanjutkan sesuai jadwal', false),
      ('status.PROCEED', 'en', 'Proceed as scheduled', false),
      ('status.MOVE_EARLIER', 'id', 'Majukan jadwal', false),
      ('status.MOVE_EARLIER', 'en', 'Move the activity earlier', false),
      ('status.DEFER', 'id', 'Tunda pelaksanaan', false),
      ('status.DEFER', 'en', 'Defer the activity', false),
      ('status.ALTERNATIVE_WINDOW', 'id', 'Gunakan waktu alternatif', false),
      ('status.ALTERNATIVE_WINDOW', 'en', 'Use an alternative time window', false),
      ('status.PROCEED_WITH_MITIGATION', 'id', 'Lanjutkan dengan langkah mitigasi', false),
      ('status.PROCEED_WITH_MITIGATION', 'en', 'Proceed with mitigation measures', false),
      ('status.NOT_RECOMMENDED', 'id', 'Tidak direkomendasikan untuk dilaksanakan', false),
      ('status.NOT_RECOMMENDED', 'en', 'Not recommended for execution', false),
      ('risk.LOW', 'id', 'Rendah', false), ('risk.LOW', 'en', 'Low', false),
      ('risk.MODERATE', 'id', 'Sedang', false), ('risk.MODERATE', 'en', 'Moderate', false),
      ('risk.HIGH', 'id', 'Tinggi', false), ('risk.HIGH', 'en', 'High', false),
      ('risk.VERY_HIGH', 'id', 'Sangat tinggi', false), ('risk.VERY_HIGH', 'en', 'Very high', false),
      ('confidence.LOW', 'id', 'Rendah', false), ('confidence.LOW', 'en', 'Low', false),
      ('confidence.MEDIUM', 'id', 'Sedang', false), ('confidence.MEDIUM', 'en', 'Medium', false),
      ('confidence.HIGH', 'id', 'Tinggi', false), ('confidence.HIGH', 'en', 'High', false),
      ('severity.info', 'id', 'informasi', false), ('severity.info', 'en', 'information', false),
      ('severity.warning', 'id', 'peringatan', false), ('severity.warning', 'en', 'warning', false),
      ('severity.critical', 'id', 'kritis', false), ('severity.critical', 'en', 'critical', false),
      ('label.risk_score', 'id', 'Skor risiko (0–100)', false), ('label.risk_score', 'en', 'Risk score (0–100)', false),
      ('label.risk_label', 'id', 'Tingkat risiko', false), ('label.risk_label', 'en', 'Risk level', false),
      ('label.confidence', 'id', 'Tingkat keyakinan prakiraan', false), ('label.confidence', 'en', 'Forecast confidence', false),
      ('label.analysis_time', 'id', 'Waktu analisis', false), ('label.analysis_time', 'en', 'Analysis time', false),
      ('label.decision', 'id', 'Keputusan', false), ('label.decision', 'en', 'Decision', false),
      ('label.reasons', 'id', 'Alasan', false), ('label.reasons', 'en', 'Reasons', false),
      ('label.no_reasons', 'id', 'Tidak ada alasan tambahan.', false), ('label.no_reasons', 'en', 'No additional reasons.', false),
      ('label.weather_report', 'id', 'Laporan Operasional Cuaca WeatherOps', false), ('label.weather_report', 'en', 'WeatherOps Operational Weather Report', false),
      ('label.disclaimer', 'id', 'Laporan ini adalah bantuan pengambilan keputusan operasional berdasarkan data prakiraan yang tersedia. Laporan ini bukan jaminan kondisi cuaca dan tidak menggantikan penilaian keselamatan di lapangan.', false),
      ('label.disclaimer', 'en', 'This report supports operational decision-making based on the available forecast data. It is not a guarantee of weather conditions and does not replace on-site safety judgment.', false)
    ON CONFLICT (code, locale) DO UPDATE SET template = EXCLUDED.template;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_report_snapshots_analysis_locale
      ON report_snapshots(analysis_result_id, locale);
  `);
}

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export function down(pgm) {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_report_snapshots_analysis_locale;
    DELETE FROM translation_catalog WHERE code IN (
      'HEAVY_RAIN_CRITICAL_SLOT', 'UNKNOWN_WEATHER_LOW_CONFIDENCE',
      'INCOMPLETE_SLOT_COVERAGE', 'CRITICAL_WINDOW_RAIN_RISK',
      'CLEAR_CONDITIONS_PROCEED', 'ALTERNATIVE_WINDOW_AVAILABLE',
      'status.PROCEED', 'status.MOVE_EARLIER', 'status.DEFER',
      'status.ALTERNATIVE_WINDOW', 'status.PROCEED_WITH_MITIGATION',
      'status.NOT_RECOMMENDED', 'label.risk_score', 'label.risk_label',
      'label.confidence', 'label.analysis_time', 'label.decision',
      'label.reasons', 'label.no_reasons', 'label.weather_report',
      'label.disclaimer'
    );
  `);
}