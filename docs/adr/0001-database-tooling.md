# ADR 0001: Database tooling

## Decision

Use `pg` for the runtime connection pool and `node-pg-migrate` as the single
database migration tool. SQL migrations live in
`src/infrastructure/database/migrations/`.

## Rationale

This keeps the Phase 0 runtime lightweight while providing explicit,
versioned migrations for later phases. No second ORM or migration system is
introduced.