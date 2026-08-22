import pg from 'pg';

import { env } from '../../app/config/env.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

export async function getPostgisVersion(): Promise<string> {
  const result = await pool.query<{ version: string }>('SELECT PostGIS_Version() AS version');
  return result.rows[0].version;
}

export async function checkDatabase(): Promise<{ connected: boolean; postgis?: string }> {
  try {
    return { connected: true, postgis: await getPostgisVersion() };
  } catch {
    return { connected: false };
  }
}