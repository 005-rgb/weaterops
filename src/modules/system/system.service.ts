import { checkDatabase } from '../../infrastructure/database/client.js';

export type HealthResponse =
  | { status: 'ok'; database: 'connected'; postgis: string; timestamp: string }
  | { status: 'degraded'; database: 'disconnected' };

export async function getHealth(): Promise<HealthResponse> {
  const database = await checkDatabase();
  if (!database.connected || !database.postgis) {
    return { status: 'degraded', database: 'disconnected' };
  }
  return {
    status: 'ok',
    database: 'connected',
    postgis: database.postgis,
    timestamp: new Date().toISOString(),
  };
}