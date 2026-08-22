import type { RequestHandler } from 'express';
import { pool } from '../../infrastructure/database/client.js';

export const getTraceTimeline: RequestHandler = async (request, response, next) => {
  try {
    const analysisId = Array.isArray(request.params.analysisId) ? request.params.analysisId[0] : request.params.analysisId;
    const result = await pool.query(
      `SELECT trace_id, event_type, payload, created_at
       FROM system_events
       WHERE payload->>'analysis_id' = $1
       ORDER BY created_at ASC`,
      [analysisId],
    );
    const traceId = result.rows[0]?.trace_id ?? null;
    response.json({
      analysisId,
      traceId,
      timeline: result.rows.map((row) => ({
        traceId: row.trace_id,
        event: row.event_type,
        payload: row.payload,
        timestamp: row.created_at,
      })),
    });
  } catch (error) {
    next(error);
  }
};