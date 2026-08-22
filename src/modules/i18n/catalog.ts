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
  'status.MOVE_EARLIER': { id: 'Majukan jadwal', en: 'Move earlier' },
  'status.DEFER': { id: 'Tunda pelaksanaan', en: 'Defer the activity' },
  'status.ALTERNATIVE_WINDOW': { id: 'Pilih jendela alternatif', en: 'Use an alternative window' },
  'status.PROCEED_WITH_MITIGATION': { id: 'Lanjutkan dengan mitigasi', en: 'Proceed with mitigation' },
  'status.NOT_RECOMMENDED': { id: 'Tidak direkomendasikan', en: 'Not recommended' },
  'label.risk_score': { id: 'Skor risiko', en: 'Risk score' },
  'label.risk_label': { id: 'Label risiko', en: 'Risk label' },
  'label.confidence': { id: 'Tingkat keyakinan', en: 'Confidence' },
  'label.analysis_time': { id: 'Waktu analisis', en: 'Analysis time' },
  'label.decision': { id: 'Keputusan', en: 'Decision' },
  'label.reasons': { id: 'Alasan', en: 'Reasons' },
  'label.no_reasons': { id: 'Tidak ada alasan tambahan.', en: 'No additional reasons.' },
  'label.weather_report': { id: 'Laporan Operasional Cuaca WeatherOps', en: 'WeatherOps Operational Weather Report' },
  'label.disclaimer': {
    id: 'Informasi ini adalah bantuan operasional, bukan jaminan kondisi cuaca.',
    en: 'This information is operational guidance, not a guarantee of weather conditions.',
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