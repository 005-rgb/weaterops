/**
 * WeatherOps v3.0 core schema.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export function up(pgm) {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION weatherops_expires_at(days integer DEFAULT NULL)
    RETURNS timestamptz
    LANGUAGE sql
    STABLE
    AS $$
      SELECT now() + make_interval(days => COALESCE(
        days,
        NULLIF(current_setting('weatherops.retention_days', true), '')::integer,
        7
      ));
    $$;

    CREATE OR REPLACE FUNCTION weatherops_touch_updated_at()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$;

    CREATE TABLE locations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      code text NOT NULL UNIQUE,
      parent_code text NULL REFERENCES locations(code),
      level text NOT NULL CHECK (level IN ('adm1','adm2','adm3','adm4')),
      name text NOT NULL,
      full_name text NOT NULL,
      active boolean NOT NULL DEFAULT true,
      geometry geometry(MultiPolygon, 4326) NULL,
      geometry_simplified geometry(MultiPolygon, 4326) NULL,
      boundary_source text NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX idx_locations_parent_code ON locations(parent_code);
    CREATE INDEX idx_locations_level ON locations(level);
    CREATE INDEX idx_locations_geometry ON locations USING gist(geometry);
    CREATE INDEX idx_locations_geometry_simplified ON locations USING gist(geometry_simplified);

    CREATE TABLE activity_profiles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      code text NOT NULL,
      version integer NOT NULL,
      name_id text NOT NULL,
      name_en text NOT NULL,
      hazard_sensitivity jsonb NOT NULL,
      active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(code, version)
    );

    CREATE TABLE weather_snapshots (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      location_code text NOT NULL REFERENCES locations(code),
      source text NOT NULL DEFAULT 'BMKG',
      raw_response jsonb NOT NULL,
      normalized_data jsonb NOT NULL,
      source_updated_at timestamptz NULL,
      fetched_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL DEFAULT weatherops_expires_at()
    );
    CREATE INDEX idx_weather_snapshots_location_fetched
      ON weather_snapshots(location_code, fetched_at DESC);

    CREATE TABLE weather_slots (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      weather_snapshot_id uuid NOT NULL REFERENCES weather_snapshots(id) ON DELETE CASCADE,
      location_code text NOT NULL REFERENCES locations(code),
       local_datetime timestamptz NOT NULL,
       weather_desc text NOT NULL,
      hazard_score smallint NOT NULL,
      raw_fields jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL DEFAULT weatherops_expires_at()
    );
    CREATE INDEX idx_weather_slots_location_datetime
      ON weather_slots(location_code, local_datetime);

    CREATE TABLE activities (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      activity_profile_code text NOT NULL,
      name_id text NOT NULL,
      name_en text NOT NULL,
      active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE analysis_requests (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      location_code text NOT NULL REFERENCES locations(code),
      activity_id uuid NOT NULL REFERENCES activities(id),
      activity_profile_code text NOT NULL,
      activity_profile_version integer NOT NULL,
      scheduled_start timestamptz NOT NULL,
      scheduled_end timestamptz NOT NULL,
      operational_impact jsonb NOT NULL,
      point_lat double precision NULL CHECK (point_lat IS NULL OR (point_lat >= -90 AND point_lat <= 90)),
      point_lng double precision NULL CHECK (point_lng IS NULL OR (point_lng >= -180 AND point_lng <= 180)),
      session_key_hash text NULL,
      locale text NOT NULL DEFAULT 'id' CHECK (locale IN ('id','en')),
      resolution_level text NULL CHECK (resolution_level IN ('adm4','adm3','adm2','adm1')),
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX idx_analysis_requests_session_created
      ON analysis_requests(session_key_hash, created_at);

    CREATE TABLE analysis_results (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      analysis_request_id uuid NOT NULL REFERENCES analysis_requests(id),
      weather_snapshot_id uuid NOT NULL REFERENCES weather_snapshots(id),
      decision_status text NOT NULL CHECK (decision_status IN
        ('PROCEED','MOVE_EARLIER','DEFER','ALTERNATIVE_WINDOW','PROCEED_WITH_MITIGATION','NOT_RECOMMENDED')),
      risk_score smallint NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
      risk_label text NOT NULL CHECK (risk_label IN ('LOW','MODERATE','HIGH','VERY_HIGH')),
      confidence text NOT NULL CHECK (confidence IN ('LOW','MEDIUM','HIGH')),
      scoring_version text NOT NULL,
      decision_engine_version text NOT NULL,
      public_token text NOT NULL UNIQUE,
      created_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL DEFAULT weatherops_expires_at(),
      deleted_at timestamptz NULL
    );
    CREATE UNIQUE INDEX idx_analysis_results_public_token ON analysis_results(public_token);
    CREATE INDEX idx_analysis_results_request ON analysis_results(analysis_request_id);

    CREATE TABLE decision_reasons (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      analysis_result_id uuid NOT NULL REFERENCES analysis_results(id) ON DELETE CASCADE,
      code text NOT NULL,
      severity text NOT NULL CHECK (severity IN ('info','warning','critical')),
      params jsonb NOT NULL DEFAULT '{}',
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX idx_decision_reasons_result ON decision_reasons(analysis_result_id);

    CREATE TABLE evidence (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      decision_reason_id uuid NOT NULL REFERENCES decision_reasons(id) ON DELETE CASCADE,
      evidence_type text NOT NULL,
      reference_id uuid NOT NULL,
      snapshot_data jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX idx_evidence_reason ON evidence(decision_reason_id);

    CREATE TABLE report_snapshots (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      analysis_result_id uuid NOT NULL REFERENCES analysis_results(id),
      locale text NOT NULL DEFAULT 'id' CHECK (locale IN ('id','en')),
      report_html text NOT NULL,
      pdf_url text NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL DEFAULT weatherops_expires_at()
    );
    CREATE INDEX idx_report_snapshots_analysis ON report_snapshots(analysis_result_id);

    CREATE TABLE session_boards (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      session_key_hash text NOT NULL,
      label text NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      last_seen_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL DEFAULT weatherops_expires_at()
    );
    CREATE INDEX idx_session_boards_session_key ON session_boards(session_key_hash);

    -- Anti-abuse records are retained for 30 days, intentionally longer than the 7-day default.
    CREATE TABLE anti_abuse_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id uuid NULL,
      event_type text NOT NULL CHECK (event_type IN
        ('CHALLENGE_ISSUED','CHALLENGE_PASSED','CHALLENGE_FAILED','RATE_BLOCKED')),
      risk_score smallint NOT NULL,
      ip_hash text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL DEFAULT weatherops_expires_at(30)
    );
    CREATE INDEX idx_anti_abuse_events_ip_hash_created ON anti_abuse_events(ip_hash, created_at);

    CREATE TABLE translation_catalog (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      code text NOT NULL,
      locale text NOT NULL CHECK (locale IN ('id','en')),
      template text NOT NULL,
      reviewed_by_human boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(code, locale)
    );

    CREATE TABLE system_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      trace_id text NULL,
      event_type text NOT NULL,
      payload jsonb NOT NULL DEFAULT '{}',
      created_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL DEFAULT weatherops_expires_at()
    );
    CREATE INDEX idx_system_events_trace_id ON system_events(trace_id);
    CREATE INDEX idx_system_events_created ON system_events(created_at);

    CREATE TRIGGER locations_updated_at BEFORE UPDATE ON locations
      FOR EACH ROW EXECUTE FUNCTION weatherops_touch_updated_at();
    CREATE TRIGGER translation_catalog_updated_at BEFORE UPDATE ON translation_catalog
      FOR EACH ROW EXECUTE FUNCTION weatherops_touch_updated_at();
  `);
}

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export function down(pgm) {
  pgm.sql(`
    DROP TABLE IF EXISTS system_events, translation_catalog, anti_abuse_events,
      session_boards, report_snapshots, evidence, decision_reasons, analysis_results,
      analysis_requests, activities, weather_slots, weather_snapshots,
      activity_profiles, locations CASCADE;
    DROP FUNCTION IF EXISTS weatherops_touch_updated_at();
    DROP FUNCTION IF EXISTS weatherops_expires_at(integer);
  `);
}