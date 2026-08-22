---
name: Migration CLI usage
description: Operational detail for running reversible node-pg-migrate commands in this project.
---

The npm migration script intentionally defaults to `up`; passing `down` after `npm run db:migrate --` appends an extra argument and does not change the action. Use the node-pg-migrate CLI directly when testing down/redo cycles.

**Why:** The first attempted cycle ran as `up down` and correctly performed no rollback, which could make a migration verification appear complete when it was not.

**How to apply:** Use the package script for normal upward migrations. For rollback or full up/down/up verification, invoke node-pg-migrate directly with the configured migration directory.