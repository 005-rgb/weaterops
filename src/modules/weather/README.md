# Weather module (Phase 2)

This module fetches BMKG forecasts, validates the assumed public response shape,
normalizes weather slots, and stores immutable snapshots. It does not make
activity decisions or calculate hazard scores.

Missing upstream values remain `null` in the canonical model. Snapshot
forensics are always persisted; slots without a parseable datetime remain in
the normalized response but are not inserted into `weather_slots`, because
they cannot be indexed as forecast times.

## Configuration

`BMKG_BASE_URL` is intentionally required at runtime for upstream requests and
must be supplied by a human after verifying the official BMKG endpoint.
`BMKG_TIMEOUT_MS` defaults to 5000, `BMKG_RATE_LIMIT_PER_MIN` to 60, and
`WEATHER_FRESHNESS_MINUTES` to 60. These defaults are safe assumptions, not
production-confirmed values.

## Manual live contract test

The harness is deliberately not part of the normal test command. After
confirming the endpoint and credentials/terms, run:

```bash
BMKG_BASE_URL=https://verified-endpoint.example/ npm run bmkg:contract -- DUMMY-KEL-1
```

It records status, latency, and schema success for the requested code. For the
required 72-hour staging evidence, QA must schedule repeated runs and attach
the resulting report; this is not claimed as completed by the code.