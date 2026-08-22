import { pool } from '../../infrastructure/database/client.js';

export interface SessionBoard {
  id: string; session_key_hash: string; label: string | null; created_at: Date;
  last_seen_at: Date; expires_at: Date;
}
export async function upsertSessionBoard(sessionKeyHash: string, label?: string | null): Promise<SessionBoard> {
  const result = await pool.query<SessionBoard>(
    `INSERT INTO session_boards (session_key_hash, label)
     VALUES ($1, $2)
     ON CONFLICT (session_key_hash) DO UPDATE SET
       last_seen_at = now(), expires_at = weatherops_expires_at(), label = COALESCE(EXCLUDED.label, session_boards.label)
     RETURNING *`,
    [sessionKeyHash, label ?? null],
  );
  return result.rows[0];
}