import { describe, expect, it, vi } from 'vitest';

import { BmkgClient, BmkgError } from '../src/infrastructure/bmkg/bmkg-client.js';

const validBody = JSON.stringify({ data: [{ cuaca: [[{ datetime: '2026-08-22T10:00:00+07:00', weather_desc: 'Cerah' }]] }] });
const response = (status: number, body = validBody) => new Response(body, { status, headers: { 'content-type': 'application/json' } });

describe('BMKG client', () => {
  it('retries two 503 responses and then succeeds', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(response(503, '{}'))
      .mockResolvedValueOnce(response(503, '{}'))
      .mockResolvedValueOnce(response(200));
    const client = new BmkgClient({
      baseUrl: 'https://example.test/forecast/',
      fetchImpl,
      sleep: vi.fn().mockResolvedValue(undefined),
    });
    await expect(client.fetchForecast('ABC')).resolves.toBeDefined();
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('does not retry a 400 response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(400, '{"error":"bad request"}'));
    const client = new BmkgClient({
      baseUrl: 'https://example.test/forecast/',
      fetchImpl,
      sleep: vi.fn().mockResolvedValue(undefined),
    });
    await expect(client.fetchForecast('ABC')).rejects.toMatchObject({ code: 'BMKG_HTTP_ERROR' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('returns a structured schema error without crashing the caller', async () => {
    const logger = vi.fn();
    const client = new BmkgClient({
      baseUrl: 'https://example.test/',
      fetchImpl: vi.fn().mockResolvedValue(response(200, '{"unexpected":true}')),
      logger,
    });
    await expect(client.fetchForecast('ABC')).rejects.toMatchObject({
      code: 'BMKG_SCHEMA_VALIDATION_FAILED',
    } satisfies Partial<BmkgError>);
    expect(logger).toHaveBeenCalledWith(expect.objectContaining({ body: { unexpected: true } }));
  });
});