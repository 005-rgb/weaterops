import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app.js';
import * as database from '../src/infrastructure/database/client.js';

describe('GET /api/v1/system/health', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns 200 when the database and PostGIS are connected', async () => {
    vi.spyOn(database, 'checkDatabase').mockResolvedValue({
      connected: true,
      postgis: '3.4.0',
    });

    const response = await request(createApp()).get('/api/v1/system/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'ok',
      database: 'connected',
      postgis: '3.4.0',
    });
    expect(response.body.timestamp).toEqual(expect.any(String));
  });

  it('returns 503 when the database is disconnected', async () => {
    vi.spyOn(database, 'checkDatabase').mockResolvedValue({ connected: false });

    const response = await request(createApp()).get('/api/v1/system/health');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      status: 'degraded',
      database: 'disconnected',
    });
  });
});