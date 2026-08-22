export const REASON_CODES = {
  HEAVY_RAIN_CRITICAL_SLOT: 'HEAVY_RAIN_CRITICAL_SLOT',
  UNKNOWN_WEATHER_LOW_CONFIDENCE: 'UNKNOWN_WEATHER_LOW_CONFIDENCE',
  INCOMPLETE_SLOT_COVERAGE: 'INCOMPLETE_SLOT_COVERAGE',
  CRITICAL_WINDOW_RAIN_RISK: 'CRITICAL_WINDOW_RAIN_RISK',
  CLEAR_CONDITIONS_PROCEED: 'CLEAR_CONDITIONS_PROCEED',
  ALTERNATIVE_WINDOW_AVAILABLE: 'ALTERNATIVE_WINDOW_AVAILABLE',
} as const;

export type ReasonCode = typeof REASON_CODES[keyof typeof REASON_CODES];
export type ReasonSeverity = 'info' | 'warning' | 'critical';

export interface DecisionReason {
  code: ReasonCode;
  severity: ReasonSeverity;
  params: Record<string, string | number>;
  evidenceRefs: string[];
}