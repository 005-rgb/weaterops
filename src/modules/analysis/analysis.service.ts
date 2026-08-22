import type { PoolClient } from 'pg';

import { withTransaction, pool } from '../../infrastructure/database/client.js';
import { BmkgError } from '../../infrastructure/bmkg/bmkg-client.js';
import { ApiError } from '../../shared/errors/error-codes.js';
import { generatePublicToken } from '../../shared/utils/public-token.js';
import {
  DECISION_ENGINE_VERSION,
  SCORING_VERSION,
  evaluateDecision,
  type DecisionEngineResult,
  type OperationalImpactInput,
} from '../decision-engine/decision-engine.js';
import { ACTIVITY_PROFILES, type ActivityProfile } from '../decision-engine/profiles.js';
import { WeatherService, WeatherServiceError } from '../weather/weather.service.js';
import type { CanonicalWeatherSlot } from '../weather/weather.types.js';
import { weatherSlotStore, weatherSnapshotStore } from '../weather/weather.repository.js';
import { BmkgClient } from '../../infrastructure/bmkg/bmkg-client.js';

export interface AnalysisDependencies {
  weatherService: Pick<WeatherService, 'getForecastWithSnapshot'>;
  query?: typeof pool.query;
  transaction?: typeof withTransaction;
  now?: () => Date;
}

export interface AnalysisResponse {
  analysisId: string;
  reportToken: string;
  status: 'completed';
  resolutionLevel: null;
  decision: {
    status: string;
    riskScore: number;
    riskLabel: string;
    confidence: string;
  };
}

function defaultWeatherService() {
  return new WeatherService({
    client: new BmkgClient(),
    snapshots: weatherSnapshotStore,
    slots: weatherSlotStore,
  });
}

export function createAnalysisService(overrides: Partial<AnalysisDependencies> = {}) {
  const dependencies: AnalysisDependencies = {
    weatherService: defaultWeatherService(),
    query: pool.query.bind(pool),
    transaction: withTransaction,
    now: () => new Date(),
    ...overrides,
  };

  async function validateInput(input: {
    locationCode: string;
    activityCode: string;
    scheduledStart: string;
  }) {
    const location = await dependencies.query!(
      'SELECT code, level FROM locations WHERE code = $1 AND active = true',
      [input.locationCode],
    );
    if (!location.rows[0]) {
      throw new ApiError('LOCATION_NOT_FOUND', 'Location was not found', 404);
    }
    if (location.rows[0].level !== 'adm4') {
      throw new ApiError('LOCATION_NOT_FOUND', 'Location must be an active adm4 location', 400, {
        field: 'locationCode',
        expectedLevel: 'adm4',
      });
    }
    const activity = await dependencies.query!(
      `SELECT a.id, a.activity_profile_code, p.version, p.hazard_sensitivity
       FROM activities a
       JOIN activity_profiles p ON p.code = a.activity_profile_code AND p.active = true
       WHERE a.activity_profile_code = $1 AND a.active = true
       ORDER BY p.version DESC LIMIT 1`,
      [input.activityCode],
    );
    if (!activity.rows[0]) {
      throw new ApiError('ACTIVITY_NOT_FOUND', 'Active activity was not found', 404);
    }
    if (dependencies.now!().getTime() > Date.parse(input.scheduledStart)) {
      throw new ApiError('VALIDATION_FAILED', 'scheduledStart cannot be in the past', 400, {
        field: 'scheduledStart',
      });
    }
    return { location: location.rows[0], activity: activity.rows[0] };
  }

  async function create(input: {
    locationCode: string;
    activityCode: string;
    scheduledStart: string;
    scheduledEnd: string;
    operationalImpact: OperationalImpactInput;
    locale: 'id' | 'en';
  }): Promise<AnalysisResponse> {
    const resolved = await validateInput(input);
    let forecast: { slots: CanonicalWeatherSlot[]; weatherSnapshotId: string };
    try {
      forecast = await dependencies.weatherService.getForecastWithSnapshot(input.locationCode);
    } catch (error) {
      if (error instanceof WeatherServiceError || error instanceof BmkgError) {
        const code = error.code === 'BMKG_SCHEMA_VALIDATION_FAILED'
          ? 'BMKG_SCHEMA_VALIDATION_FAILED' : 'WEATHER_SOURCE_UNAVAILABLE';
        throw new ApiError(code, 'Weather source is temporarily unavailable', 503);
      }
      throw error;
    }

    const profile = ACTIVITY_PROFILES[resolved.activity.activity_profile_code] as ActivityProfile | undefined;
    if (!profile) {
      throw new ApiError('ACTIVITY_NOT_FOUND', 'Activity profile is not configured', 404);
    }
    const decision = evaluateDecision({
      weatherSlots: forecast.slots,
      activityProfile: profile,
      scheduledWindow: { start: input.scheduledStart, end: input.scheduledEnd },
      operationalImpact: input.operationalImpact,
      forecastHorizonEnd: new Date(Date.parse(input.scheduledEnd) + 24 * 60 * 60 * 1000).toISOString(),
    });
    const token = generatePublicToken();
    const result = await dependencies.transaction!(async (client) => persist(client, input, resolved, forecast.weatherSnapshotId, decision, token));
    return {
      analysisId: result.analysisId,
      reportToken: token,
      status: 'completed',
      resolutionLevel: null,
      decision: {
        status: decision.decisionStatus,
        riskScore: decision.riskScore,
        riskLabel: decision.riskLabel,
        confidence: decision.confidence,
      },
    };
  }

  return { create, validateInput };
}

async function persist(
  client: PoolClient,
  input: { locationCode: string; activityCode: string; scheduledStart: string; scheduledEnd: string; operationalImpact: OperationalImpactInput; locale: 'id' | 'en' },
  resolved: { activity: { id: string; activity_profile_code: string; version: number } },
  snapshotId: string,
  decision: DecisionEngineResult,
  token: string,
) {
  const request = await client.query<{ id: string }>(
    `INSERT INTO analysis_requests
      (location_code, activity_id, activity_profile_code, activity_profile_version,
       scheduled_start, scheduled_end, operational_impact, locale, resolution_level)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NULL) RETURNING id`,
    [input.locationCode, resolved.activity.id, resolved.activity.activity_profile_code,
      resolved.activity.version, input.scheduledStart, input.scheduledEnd,
      input.operationalImpact, input.locale],
  );
  const analysisRequestId = request.rows[0].id;
  const result = await client.query<{ id: string }>(
    `INSERT INTO analysis_results
      (analysis_request_id, weather_snapshot_id, decision_status, risk_score, risk_label,
       confidence, scoring_version, decision_engine_version, public_token)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [analysisRequestId, snapshotId, decision.decisionStatus, decision.riskScore, decision.riskLabel,
      decision.confidence, SCORING_VERSION, DECISION_ENGINE_VERSION, token],
  );
  const analysisResultId = result.rows[0].id;
  for (const reason of decision.reasons) {
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO decision_reasons (analysis_result_id, code, severity, params)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [analysisResultId, reason.code, reason.severity, reason.params],
    );
    for (const reference of reason.evidenceRefs) {
      await client.query(
        `INSERT INTO evidence (decision_reason_id, evidence_type, reference_id, snapshot_data)
         VALUES ($1,$2,$3,$4)`,
        [inserted.rows[0].id, 'weather_forecast', snapshotId, { reference }],
      );
    }
  }
  return { analysisId: analysisRequestId };
}

export const analysisService = createAnalysisService();