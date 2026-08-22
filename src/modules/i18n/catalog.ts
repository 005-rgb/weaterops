import { REASON_CODES, type ReasonCode } from '../decision-engine/reason-codes.js';

export const CATALOG_ENTRIES: Record<string, { id: string; en: string }> = {
  HEAVY_RAIN_CRITICAL_SLOT: {
    id: 'Hujan lebat berada dalam waktu kerja.',
    en: 'Heavy rain falls within the work window.',
  },
  UNKNOWN_WEATHER_LOW_CONFIDENCE: {
    id: 'Data cuaca tidak dikenal menurunkan tingkat keyakinan.',
    en: 'Unknown weather data lowers confidence.',
  },
  INCOMPLETE_SLOT_COVERAGE: {
    id: 'Cakupan slot prakiraan tidak lengkap.',
    en: 'Forecast slot coverage is incomplete.',
  },
  CRITICAL_WINDOW_RAIN_RISK: {
    id: 'Terdapat risiko hujan pada jendela kritis.',
    en: 'There is rain risk during the critical window.',
  },
  CLEAR_CONDITIONS_PROCEED: {
    id: 'Kondisi cuaca mendukung pelaksanaan.',
    en: 'Weather conditions support proceeding.',
  },
  ALTERNATIVE_WINDOW_AVAILABLE: {
    id: 'Tersedia jendela waktu alternatif.',
    en: 'An alternative time window is available.',
  },
  'status.PROCEED': { id: 'Lanjutkan sesuai jadwal', en: 'Proceed as scheduled' },
  'status.MOVE_EARLIER': { id: 'Majukan jadwal', en: 'Move the activity earlier' },
  'status.DEFER': { id: 'Tunda pelaksanaan', en: 'Defer the activity' },
  'status.ALTERNATIVE_WINDOW': { id: 'Gunakan waktu alternatif', en: 'Use an alternative time window' },
  'status.PROCEED_WITH_MITIGATION': { id: 'Lanjutkan dengan langkah mitigasi', en: 'Proceed with mitigation measures' },
  'status.NOT_RECOMMENDED': { id: 'Tidak direkomendasikan untuk dilaksanakan', en: 'Not recommended for execution' },
  'risk.LOW': { id: 'Rendah', en: 'Low' },
  'risk.MODERATE': { id: 'Sedang', en: 'Moderate' },
  'risk.HIGH': { id: 'Tinggi', en: 'High' },
  'risk.VERY_HIGH': { id: 'Sangat tinggi', en: 'Very high' },
  'confidence.LOW': { id: 'Rendah', en: 'Low' },
  'confidence.MEDIUM': { id: 'Sedang', en: 'Medium' },
  'confidence.HIGH': { id: 'Tinggi', en: 'High' },
  'severity.info': { id: 'informasi', en: 'information' },
  'severity.warning': { id: 'peringatan', en: 'warning' },
  'severity.critical': { id: 'kritis', en: 'critical' },
  'label.risk_score': { id: 'Skor risiko (0–100)', en: 'Risk score (0–100)' },
  'label.risk_label': { id: 'Tingkat risiko', en: 'Risk level' },
  'label.confidence': { id: 'Tingkat keyakinan prakiraan', en: 'Forecast confidence' },
  'label.analysis_time': { id: 'Waktu analisis', en: 'Analysis time' },
  'label.decision': { id: 'Rekomendasi keputusan', en: 'Decision recommendation' },
  'label.reasons': { id: 'Dasar rekomendasi', en: 'Recommendation basis' },
  'label.no_reasons': { id: 'Tidak ada alasan tambahan.', en: 'No additional reasons.' },
  'label.weather_report': { id: 'Laporan Operasional Cuaca WeatherOps', en: 'WeatherOps Operational Weather Report' },
  'label.disclaimer': {
    id: 'Laporan ini adalah bantuan pengambilan keputusan operasional berdasarkan data prakiraan yang tersedia. Laporan ini bukan jaminan kondisi cuaca dan tidak menggantikan penilaian keselamatan di lapangan.',
    en: 'This report supports operational decision-making based on the available forecast data. It is not a guarantee of weather conditions and does not replace on-site safety judgment.',
  },
};

export const REASON_CATALOG_CODES: ReasonCode[] = Object.values(REASON_CODES);

export function assertReasonCatalogComplete(): void {
  for (const code of REASON_CATALOG_CODES) {
    if (!CATALOG_ENTRIES[code]?.id || !CATALOG_ENTRIES[code]?.en) {
      throw new Error(`Missing translation catalog pair for ${code}`);
    }
  }
}