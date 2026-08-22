import { performance } from 'node:perf_hooks';
import { pool } from '../src/infrastructure/database/client.js';
import { resolvePoint } from '../src/modules/geospatial/geospatial.repository.js';

const samples: number[] = [];
try {
  for (let index = 0; index < 100; index += 1) {
    const started = performance.now();
    await resolvePoint(0, -0.01);
    samples.push(performance.now() - started);
  }
  samples.sort((a, b) => a - b);
  console.log(JSON.stringify({
    iterations: samples.length,
    p95Ms: Number(samples[Math.ceil(samples.length * 0.95) - 1].toFixed(2)),
    maxMs: Number(samples.at(-1)!.toFixed(2)),
    targetMs: 150,
    passed: samples[Math.ceil(samples.length * 0.95) - 1] < 150,
  }));
} finally {
  await pool.end();
}