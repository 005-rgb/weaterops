import './infrastructure/tracing/setup.js';
import { createApp } from './app.js';
import { env } from './app/config/env.js';
import { getPostgisVersion } from './infrastructure/database/client.js';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = createApp();
const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist/frontend');
app.use(express.static(frontendRoot));
app.get(/^(?!\/api(?:\/|$)).*/, (_request, response) => {
  response.sendFile(path.join(frontendRoot, 'index.html'));
});

try {
  const version = await getPostgisVersion();
  console.log(JSON.stringify({ level: 'info', event: 'postgis_ready', postgis: version }));
} catch (error) {
  console.warn(
    JSON.stringify({
      level: 'warn',
      event: 'postgis_unavailable',
      message: error instanceof Error ? error.message : 'Database unavailable',
    }),
  );
}

app.listen(env.PORT, '0.0.0.0', () => {
  console.log(JSON.stringify({ level: 'info', event: 'server_started', port: env.PORT }));
});