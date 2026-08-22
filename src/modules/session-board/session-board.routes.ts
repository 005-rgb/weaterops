import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { pool } from '../../infrastructure/database/client.js';
import { ApiError } from '../../shared/errors/error-codes.js';
import { upsertSessionBoard } from './session-board.repository.js';

const router = Router();
const params = z.object({ sessionKeyHash: z.string().regex(/^[a-f0-9]{64}$/) });
const filters = z.object({
  status: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  activity: z.string().optional(),
});

function authorized(request: Parameters<RequestHandler>[0], hash: string): void {
  if (!request.sessionKeyHash || request.sessionKeyHash !== hash) {
    throw new ApiError('SESSION_BOARD_FORBIDDEN', 'Session board access denied', 403);
  }
}

router.post('/', async (request, response, next) => {
  try {
    if (!request.sessionKeyHash) throw new ApiError('SESSION_BOARD_UNAUTHORIZED', 'X-Session-Key is required', 401);
    const body = z.object({ label: z.string().trim().max(120).optional() }).parse(request.body ?? {});
    const board = await upsertSessionBoard(request.sessionKeyHash, body.label);
    response.status(201).json({ sessionKeyHash: board.session_key_hash, label: board.label, expiresAt: board.expires_at.toISOString() });
  } catch (error) { next(error); }
});

router.get('/:sessionKeyHash/analyses', async (request, response, next) => {
  try {
    const { sessionKeyHash } = params.parse(request.params);
    authorized(request, sessionKeyHash);
    const filter = filters.parse(request.query);
    const values: unknown[] = [sessionKeyHash];
    const where = ['ar.session_key_hash = $1', 'r.deleted_at IS NULL', 'r.expires_at > now()'];
    if (filter.status) { values.push(filter.status); where.push(`r.decision_status = $${values.length}`); }
    if (filter.dateFrom) { values.push(filter.dateFrom); where.push(`ar.scheduled_start >= $${values.length}`); }
    if (filter.dateTo) { values.push(filter.dateTo); where.push(`ar.scheduled_end <= $${values.length}`); }
    if (filter.activity) { values.push(filter.activity); where.push(`a.activity_profile_code = $${values.length}`); }
    const result = await pool.query(
      `SELECT ar.id AS "analysisId", r.public_token AS "publicToken", l.name AS "locationName",
        ar.location_code AS "locationCode", a.name_id AS "activityName", ar.scheduled_start AS "scheduledStart",
        ar.scheduled_end AS "scheduledEnd", r.decision_status AS "decisionStatus", r.risk_label AS "riskLabel",
        r.risk_score AS "riskScore", r.confidence, ar.point_lat AS latitude, ar.point_lng AS longitude, r.created_at AS "createdAt"
       FROM analysis_requests ar JOIN analysis_results r ON r.analysis_request_id = ar.id
       JOIN locations l ON l.code = ar.location_code JOIN activities a ON a.id = ar.activity_id
       WHERE ${where.join(' AND ')} ORDER BY ar.created_at DESC`,
      values,
    );
    response.json(result.rows);
  } catch (error) { next(error); }
});

router.get('/:sessionKeyHash/summary', async (request, response, next) => {
  try {
    const { sessionKeyHash } = params.parse(request.params); authorized(request, sessionKeyHash);
    const result = await pool.query<{ total: string; decision_status: string; risk_label: string }>(
      `SELECT COUNT(*) OVER () AS total, r.decision_status, r.risk_label
       FROM analysis_requests ar JOIN analysis_results r ON r.analysis_request_id = ar.id
       WHERE ar.session_key_hash = $1 AND r.deleted_at IS NULL AND r.expires_at > now()`,
      [sessionKeyHash],
    );
    const summary = { totalAnalyses: result.rows.length ? Number(result.rows[0].total) : 0, byDecisionStatus: {} as Record<string, number>, byRiskLabel: {} as Record<string, number> };
    for (const row of result.rows) { summary.byDecisionStatus[row.decision_status] = (summary.byDecisionStatus[row.decision_status] ?? 0) + 1; summary.byRiskLabel[row.risk_label] = (summary.byRiskLabel[row.risk_label] ?? 0) + 1; }
    response.json(summary);
  } catch (error) { next(error); }
});

router.get('/:sessionKeyHash/regional-trend', async (request, response, next) => {
  try {
    const { sessionKeyHash } = params.parse(request.params); authorized(request, sessionKeyHash);
    const result = await pool.query(
      `SELECT l.code AS "locationCode", l.name AS "locationName", ws.local_datetime AS datetime, ws.hazard_score AS "hazardScore"
       FROM analysis_requests ar JOIN analysis_results r ON r.analysis_request_id = ar.id
       JOIN locations l ON l.code = ar.location_code JOIN weather_slots ws ON ws.weather_snapshot_id = r.weather_snapshot_id
       WHERE ar.session_key_hash = $1 AND r.deleted_at IS NULL AND r.expires_at > now() AND ws.expires_at > now()
       ORDER BY l.code, ws.local_datetime`,
      [sessionKeyHash],
    );
    const grouped = new Map<string, { locationCode: string; locationName: string; series: { datetime: Date; hazardScore: number }[] }>();
    for (const row of result.rows) {
      const key = row.locationCode;
      let entry = grouped.get(key);
      if (!entry) {
        entry = { locationCode: row.locationCode, locationName: row.locationName, series: [] };
        grouped.set(key, entry);
      }
      entry.series.push({ datetime: row.datetime, hazardScore: row.hazardScore });
    }
    response.json([...grouped.values()]);
  } catch (error) { next(error); }
});

router.delete('/:sessionKeyHash', async (request, response, next) => {
  try {
    const { sessionKeyHash } = params.parse(request.params); authorized(request, sessionKeyHash);
    await pool.query('DELETE FROM session_boards WHERE session_key_hash = $1', [sessionKeyHash]);
    response.status(204).send();
  } catch (error) { next(error); }
});

export const sessionBoardRouter = router;