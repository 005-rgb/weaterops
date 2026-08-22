# WeatherOps

Phase 0 scaffold for the WeatherOps operational weather decision backend.

## Requirements

- Node.js 24.x
- PostgreSQL 17+ with PostGIS 3.4+
- npm

## Run

```bash
cp .env.example .env
npm install
npm run db:migrate
npm run dev
```

The health endpoint is available at `GET /api/v1/system/health`.