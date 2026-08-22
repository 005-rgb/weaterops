import { createApp } from './app.js';
import { env } from './app/config/env.js';
import { getPostgisVersion } from './infrastructure/database/client.js';

const app = createApp();

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