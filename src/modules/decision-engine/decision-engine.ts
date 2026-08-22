import type { CanonicalWeatherSlot } from '../weather/weather.types.js';
import { REASON_CODES, type DecisionReason } from './reason-codes.js';
import type { ActivityProfile, HazardCode } from './profiles.js';

export const SCORING_VERSION = 'v1.0.0';
export const DECISION_ENGINE_VERSION = 'v1.0.0';

export const HAZARD_SCORE_TABLE: Record<HazardCode, number> = {
  CERAH: 0, CERAH_BERAWAN: 5, BERAWAN: 10, BERAWAN_TEBAL: 20,
  HUJAN_RINGAN: 20, HUJAN_SEDANG: 45, HUJAN_LEBAT: 70, HUJAN_PETIR: 90,
  HUJAN_LOKAL: 55, KABUT: 40, ASAP: 45, UDARA_KABUR: 35,
  // UNKNOWN is deliberately neither safe (0) nor an alarm (100): 50 records
  // uncertainty and calculateConfidence lowers trust separately.
  UNKNOWN: 50,
};

export type RiskLabel = 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH';
export type DecisionStatus = 'PROCEED' | 'MOVE_EARLIER' | 'DEFER' | 'ALTERNATIVE_WINDOW'
  | 'PROCEED_WITH_MITIGATION' | 'NOT_RECOMMENDED';

export interface TimeRange {
  start: string;
  end: string;
}

export interface OperationalImpactInput {
  impactMultiplier?: number;
}

export interface SlotCoverage {
  complete: boolean;
  ratio?: number;
}

export interface AlternativeWindow {
  window: TimeRange;
  riskScore: number;
  riskLabel: RiskLabel;
}

export interface RiskScoreResult {
  score: number;
  relevantSlotRefs: string[];
  criticalSlotViolated: boolean;
}

export interface DecisionEngineResult {
  riskScore: number;
  riskLabel: RiskLabel;
  decisionStatus: DecisionStatus;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  reasons: DecisionReason[];
  alternativeWindows: AlternativeWindow[];
  scoringVersion: string;
  decisionEngineVersion: string;
}

function timestamp(value: string): number {
  const result = Date.parse(value);
  return Number.isFinite(result) ? result : NaN;
}

function slotRef(slot: CanonicalWeatherSlot, index: number): string {
  return `${slot.locationCode}:${slot.localDatetime ?? 'unknown'}:${index}`;
}

function slotCode(slot: CanonicalWeatherSlot): HazardCode {
  return slot.weatherDescNormalized;
}

function relevantSlots(
  slots: CanonicalWeatherSlot[],
  window: TimeRange,
  criticalWindowHours: number,
): Array<{ slot: CanonicalWeatherSlot; index: number; critical: boolean; ref: string }> {
  const start = timestamp(window.start);
  const end = timestamp(window.end);
  const criticalEnd = end + criticalWindowHours * 3_600_000;
  return slots.flatMap((slot, index) => {
    const time = slot.localDatetime ? timestamp(slot.localDatetime) : NaN;
    if (!Number.isFinite(time) || time < start || time > criticalEnd) return [];
    return [{ slot, index, critical: time > end, ref: slotRef(slot, index) }];
  });
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function riskLabel(score: number): RiskLabel {
  if (score <= 24) return 'LOW';
  if (score <= 49) return 'MODERATE';
  if (score <= 74) return 'HIGH';
  return 'VERY_HIGH';
}

/**
 * Formula: weighted mean of hazard score × profile sensitivity. Direct-work
 * slots have weight 1; post-work curing slots have weight 0.85. Operational
 * impact multiplies the result and is clamped to 0..100.
 */
export function calculateRiskScore(
  weatherSlots: CanonicalWeatherSlot[],
  profile: ActivityProfile,
  scheduledWindow: TimeRange,
  operationalImpact: OperationalImpactInput = {},
): RiskScoreResult {
  const relevant = relevantSlots(weatherSlots, scheduledWindow, profile.hazardSensitivity.criticalWindowHours);
  if (!relevant.length) return { score: 50, relevantSlotRefs: [], criticalSlotViolated: false };
  let weightedTotal = 0;
  let weights = 0;
  let criticalSlotViolated = false;
  for (const item of relevant) {
    const code = slotCode(item.slot);
    const hazard = HAZARD_SCORE_TABLE[code];
    const sensitivity = profile.hazardSensitivity.hazardWeights[code] ?? profile.hazardSensitivity.hazardWeights.UNKNOWN;
    const phaseWeight = item.critical ? 0.85 : 1;
    weightedTotal += hazard * sensitivity * phaseWeight;
    weights += sensitivity * phaseWeight;
    if (item.critical === false && hazard >= 70 && sensitivity >= 0.7) criticalSlotViolated = true;
    if (item.critical && hazard >= 70 && sensitivity >= 0.7) criticalSlotViolated = true;
  }
  const multiplier = Number.isFinite(operationalImpact.impactMultiplier)
    ? Math.max(0, operationalImpact.impactMultiplier ?? 1) : 1;
  return {
    score: clamp((weightedTotal / Math.max(weights, 1)) * multiplier),
    relevantSlotRefs: relevant.map((item) => item.ref),
    criticalSlotViolated,
  };
}

export function calculateConfidence(
  weatherSlots: CanonicalWeatherSlot[],
  snapshotAgeMinutes: number,
  slotCoverage: SlotCoverage,
  scheduledWindow?: TimeRange,
): 'LOW' | 'MEDIUM' | 'HIGH' {
  const slots = scheduledWindow
    ? relevantSlots(weatherSlots, scheduledWindow, 0).map((item) => item.slot)
    : weatherSlots;
  const unknown = slots.some((slot) => slot.weatherDescNormalized === 'UNKNOWN');
  const incomplete = !slotCoverage.complete || (slotCoverage.ratio ?? 1) < 1;
  let score = 3;
  if (unknown) score -= 2;
  if (incomplete) score -= 1;
  if (!Number.isFinite(snapshotAgeMinutes) || snapshotAgeMinutes >= 60) score -= 1;
  else if (snapshotAgeMinutes >= 45) score -= 0.5;
  return score <= 1 ? 'LOW' : score < 3 ? 'MEDIUM' : 'HIGH';
}

export function determineDecisionStatus(
  score: number,
  criticalSlotViolated: boolean,
  profile: ActivityProfile,
  confidence: 'LOW' | 'MEDIUM' | 'HIGH' = 'HIGH',
): DecisionStatus {
  if (criticalSlotViolated) return score >= 75 ? 'NOT_RECOMMENDED' : 'DEFER';
  if (confidence === 'LOW' && profile.hazardSensitivity.minAcceptableConfidence !== 'LOW') return 'PROCEED_WITH_MITIGATION';
  if (score <= 5) return 'PROCEED';
  if (score <= 24) return 'PROCEED_WITH_MITIGATION';
  if (score <= 49) return 'PROCEED_WITH_MITIGATION';
  return score >= 75 ? 'DEFER' : 'ALTERNATIVE_WINDOW';
}

function reason(
  code: DecisionReason['code'],
  severity: DecisionReason['severity'],
  refs: string[],
  params: Record<string, string | number> = {},
): DecisionReason {
  return { code, severity, params, evidenceRefs: refs.length ? refs : ['forecast:horizon'] };
}

export function findAlternativeWindows(
  weatherSlots: CanonicalWeatherSlot[],
  profile: ActivityProfile,
  originalWindow: TimeRange,
  horizonEnd: string,
): AlternativeWindow[] {
  const duration = timestamp(originalWindow.end) - timestamp(originalWindow.start);
  const horizon = timestamp(horizonEnd);
  return weatherSlots
    .filter((slot) => slot.localDatetime && timestamp(slot.localDatetime) >= timestamp(originalWindow.end)
      && timestamp(slot.localDatetime) + duration <= horizon)
    .map((slot) => {
      const start = timestamp(slot.localDatetime!);
      const window = { start: new Date(start).toISOString(), end: new Date(start + duration).toISOString() };
      const result = calculateRiskScore(weatherSlots, profile, window);
      return { window, riskScore: result.score, riskLabel: riskLabel(result.score) };
    })
    .filter((item, index, items) => items.findIndex((candidate) => candidate.window.start === item.window.start) === index)
    .sort((a, b) => a.riskScore - b.riskScore || a.window.start.localeCompare(b.window.start))
    .slice(0, 5);
}

export function evaluateDecision(input: {
  weatherSlots: CanonicalWeatherSlot[];
  activityProfile: ActivityProfile;
  scheduledWindow: TimeRange;
  operationalImpact: OperationalImpactInput;
  forecastHorizonEnd: string;
  snapshotAgeMinutes?: number;
  slotCoverage?: SlotCoverage;
}): DecisionEngineResult {
  const score = calculateRiskScore(input.weatherSlots, input.activityProfile, input.scheduledWindow, input.operationalImpact);
  const confidence = calculateConfidence(
    input.weatherSlots,
    input.snapshotAgeMinutes ?? 0,
    input.slotCoverage ?? { complete: true },
    input.scheduledWindow,
  );
  const status = determineDecisionStatus(score.score, score.criticalSlotViolated, input.activityProfile, confidence);
  const relevant = relevantSlots(input.weatherSlots, input.scheduledWindow, input.activityProfile.hazardSensitivity.criticalWindowHours);
  const reasons: DecisionReason[] = [];
  const unknownRefs = relevant.filter((item) => item.slot.weatherDescNormalized === 'UNKNOWN').map((item) => item.ref);
  if (unknownRefs.length) reasons.push(reason(REASON_CODES.UNKNOWN_WEATHER_LOW_CONFIDENCE, 'warning', unknownRefs));
  if (!(input.slotCoverage ?? { complete: true }).complete) {
    reasons.push(reason(REASON_CODES.INCOMPLETE_SLOT_COVERAGE, 'warning', score.relevantSlotRefs));
  }
  const criticalRefs = relevant.filter((item) => HAZARD_SCORE_TABLE[slotCode(item.slot)] >= 70).map((item) => item.ref);
  if (score.criticalSlotViolated) {
    reasons.push(reason(REASON_CODES.HEAVY_RAIN_CRITICAL_SLOT, 'critical', criticalRefs));
  }
  const curingRefs = relevant.filter((item) => item.critical && HAZARD_SCORE_TABLE[slotCode(item.slot)] >= 45).map((item) => item.ref);
  if (curingRefs.length) reasons.push(reason(REASON_CODES.CRITICAL_WINDOW_RAIN_RISK, 'warning', curingRefs));
  if (status === 'PROCEED' && !reasons.length) reasons.push(reason(REASON_CODES.CLEAR_CONDITIONS_PROCEED, 'info', score.relevantSlotRefs));
  const alternatives = status === 'DEFER' || status === 'ALTERNATIVE_WINDOW'
    ? findAlternativeWindows(input.weatherSlots, input.activityProfile, input.scheduledWindow, input.forecastHorizonEnd)
    : [];
  if (alternatives.length) reasons.push(reason(REASON_CODES.ALTERNATIVE_WINDOW_AVAILABLE, 'info', score.relevantSlotRefs));
  return {
    riskScore: score.score,
    riskLabel: riskLabel(score.score),
    decisionStatus: status,
    confidence,
    reasons,
    alternativeWindows: alternatives,
    scoringVersion: SCORING_VERSION,
    decisionEngineVersion: DECISION_ENGINE_VERSION,
  };
}