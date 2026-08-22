# WeatherOps

WeatherOps operational weather decision backend. Phase 1 provides the PostgreSQL/PostGIS
core data model and repository layer; business logic is intentionally not included yet.

## Requirements

- Node.js 24.x
- PostgreSQL 17+ with PostGIS 3.4+
- npm
- A `DATABASE_URL` pointing to PostgreSQL with PostGIS enabled

## Run

```bash
cp .env.example .env
npm install
npm run db:migrate
npm run seed:dev
npm run dev
```

The health endpoint is available at `GET /api/v1/system/health`.

## Phase 1 database model

The migrations create 14 tables: `locations`, `activity_profiles`, `weather_snapshots`,
`weather_slots`, `activities`, `analysis_requests`, `analysis_results`,
`decision_reasons`, `evidence`, `report_snapshots`, `session_boards`,
`anti_abuse_events`, `translation_catalog`, and `system_events`.

UUID primary keys use `pgcrypto`, spatial columns and indexes use PostGIS, and mutable
tables update `updated_at` through database triggers. Retention defaults to
`RETENTION_DAYS=7`; the anti-abuse event table explicitly retains records for 30 days.
The development seed is safe to run repeatedly and only inserts reference data.