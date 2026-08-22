The Phase 1 schema includes `anti_abuse_events` for future anti-abuse logic.
Its retention is explicitly 30 days, longer than the system default of 7 days.
The `ip_hash` column must always contain a salted hash; raw IP addresses must never
be written. Rate limiting, Turnstile verification, and event-producing services
remain deferred to Phase 8.