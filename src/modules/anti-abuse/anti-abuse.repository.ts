import { createRepository, type Repository } from '../../infrastructure/database/repository.js';

export interface AntiAbuseEvent {
  id: string; request_id: string | null; event_type: string; risk_score: number;
  ip_hash: string; created_at: Date; expires_at: Date;
}
export const antiAbuseEventsRepository: Repository<AntiAbuseEvent> = createRepository(
  'anti_abuse_events', ['request_id', 'event_type', 'risk_score', 'ip_hash'],
);

export async function countRecentAnalyses(sessionKeyHash: string): Promise<number> {
  const { pool } = await import('../../infrastructure/database/client.js');
  const result = await pool.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM analysis_requests
     WHERE session_key_hash = $1 AND created_at >= now() - interval '24 hours'`,
    [sessionKeyHash],
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function cleanupExpiredAntiAbuseEvents(now = new Date()): Promise<number> {
  const { pool } = await import('../../infrastructure/database/client.js');
  const result = await pool.query(
    `DELETE FROM anti_abuse_events
     WHERE created_at < $1::timestamptz - interval '30 days'`,
    [now],
  );
  return result.rowCount ?? 0;
}