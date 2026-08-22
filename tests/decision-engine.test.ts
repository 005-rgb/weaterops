import { describe, expect, it } from 'vitest';

import {
  evaluateDecision,
  HAZARD_SCORE_TABLE,
} from '../src/modules/decision-engine/decision-engine.js';
import { ACTIVITY_PROFILES } from '../src/modules/decision-engine/profiles.js';

const window = { start: '2026-08-22T10:00:00Z', end: '2026-08-22T11:00:00Z' };
const horizon = '2026-08-24T23:00:00Z';

function slot(datetime: string, weatherDescNormalized: keyof typeof HAZARD_SCORE_TABLE) {
  return {
    locationCode: 'TEST',
    localDatetime: datetime,
    weatherDesc: weatherDescNormalized,
    weatherDescNormalized,
    temperatureC: 30,
    humidityPct: 70,
    windSpeedMs: 2,
    windDirection: 'N',
    cloudCoverPct: 10,
  };
}

function evaluate(weatherSlots: ReturnType<typeof slot>[], profile = ACTIVITY_PROFILES.CONCRETE_POUR, extra = {}) {
  return evaluateDecision({
    weatherSlots,
    activityProfile: profile,
    scheduledWindow: window,
    operationalImpact: {},
    forecastHorizonEnd: horizon,
    ...extra,
  });
}

describe('pure deterministic decision engine', () => {
  it('returns PROCEED and LOW risk for clear conditions', () => {
    const result = evaluate([slot('2026-08-22T10:00:00Z', 'CERAH')]);
    expect(result).toMatchObject({ decisionStatus: 'PROCEED', riskLabel: 'LOW', riskScore: 0 });
  });

  it('applies the critical-slot override to heavy rain', () => {
    const result = evaluate([slot('2026-08-22T10:00:00Z', 'HUJAN_LEBAT')], undefined, {
      operationalImpact: { impactMultiplier: 1.2 },
    });
    expect(result).toMatchObject({ decisionStatus: 'NOT_RECOMMENDED', riskLabel: 'VERY_HIGH' });
    expect(result.reasons.map((reason) => reason.code)).toContain('HEAVY_RAIN_CRITICAL_SLOT');
  });

  it('uses mitigation for light rain rather than treating it as clear', () => {
    expect(evaluate([slot('2026-08-22T10:00:00Z', 'HUJAN_RINGAN')]).decisionStatus)
      .toBe('PROCEED_WITH_MITIGATION');
  });

  it('lowers confidence and emits a reason for UNKNOWN weather', () => {
    const result = evaluate([slot('2026-08-22T10:00:00Z', 'UNKNOWN')]);
    expect(result.confidence).toBe('LOW');
    expect(result.reasons.map((reason) => reason.code)).toContain('UNKNOWN_WEATHER_LOW_CONFIDENCE');
  });

  it('reports incomplete forecast coverage', () => {
    const result = evaluate(
      [slot('2026-08-22T10:00:00Z', 'CERAH')],
      undefined,
      { slotCoverage: { complete: false, ratio: 0.5 } },
    );
    expect(result.reasons.map((reason) => reason.code)).toContain('INCOMPLETE_SLOT_COVERAGE');
    expect(result.confidence).toBe('MEDIUM');
  });

  it('finds and orders a clean alternative window', () => {
    const result = evaluate([
      slot('2026-08-22T10:00:00Z', 'HUJAN_LEBAT'),
      slot('2026-08-23T10:00:00Z', 'CERAH'),
      slot('2026-08-23T11:00:00Z', 'CERAH'),
    ]);
    expect(result.decisionStatus).toBe('DEFER');
    expect(result.alternativeWindows[0]).toMatchObject({ riskScore: 0, riskLabel: 'LOW' });
    expect(result.reasons.map((reason) => reason.code)).toContain('ALTERNATIVE_WINDOW_AVAILABLE');
  });

  it('does not let many clear slots hide one critical slot', () => {
    const result = evaluate([
      slot('2026-08-22T10:00:00Z', 'HUJAN_PETIR'),
      slot('2026-08-22T10:15:00Z', 'CERAH'),
      slot('2026-08-22T10:30:00Z', 'CERAH'),
      slot('2026-08-22T10:45:00Z', 'CERAH'),
    ]);
    expect(['DEFER', 'NOT_RECOMMENDED']).toContain(result.decisionStatus);
  });

  it('is generic: the same weather produces different activity decisions', () => {
    const weather = [slot('2026-08-22T10:00:00Z', 'HUJAN_RINGAN')];
    expect(evaluate(weather, ACTIVITY_PROFILES.CONCRETE_POUR).decisionStatus)
      .toBe('PROCEED_WITH_MITIGATION');
    expect(evaluate(weather, ACTIVITY_PROFILES.EARTHWORK).decisionStatus).toBe('PROCEED');
  });

  it('produces byte-identical output for 100 identical evaluations', () => {
    const input = [slot('2026-08-22T10:00:00Z', 'HUJAN_SEDANG')];
    const outputs = Array.from({ length: 100 }, () => JSON.stringify(evaluate(input)));
    expect(new Set(outputs).size).toBe(1);
  });

  it('always attaches evidence to every generated reason', () => {
    const result = evaluate([
      slot('2026-08-22T10:00:00Z', 'HUJAN_LEBAT'),
      slot('2026-08-22T16:00:00Z', 'HUJAN_SEDANG'),
    ], undefined, { slotCoverage: { complete: false } });
    expect(result.reasons.every((reason) => reason.evidenceRefs.length > 0)).toBe(true);
  });
});