import { BmkgClient, getBmkgHealthStatus } from '../src/infrastructure/bmkg/bmkg-client.js';

const locationCode = process.argv[2];
if (!locationCode) {
  console.error('Usage: BMKG_BASE_URL=<verified-url> npm run bmkg:contract -- <location-code>');
  process.exitCode = 1;
} else {
  const started = performance.now();
  try {
    const response = await new BmkgClient().fetchForecast(locationCode);
    console.log(JSON.stringify({
      event: 'bmkg_contract_observation',
      locationCode,
      ok: true,
      latencyMs: Math.round(performance.now() - started),
      regions: response.data.length,
      health: getBmkgHealthStatus(),
      observedAt: new Date().toISOString(),
    }));
  } catch (error) {
    console.error(JSON.stringify({
      event: 'bmkg_contract_observation',
      locationCode,
      ok: false,
      latencyMs: Math.round(performance.now() - started),
      error: error instanceof Error ? error.message : String(error),
      code: error && typeof error === 'object' && 'code' in error ? error.code : undefined,
      observedAt: new Date().toISOString(),
    }));
    process.exitCode = 1;
  }
}