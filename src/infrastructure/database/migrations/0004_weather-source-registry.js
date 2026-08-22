/**
 * Registry and immutable audit log for weather API providers.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export function up(pgm) {
  pgm.sql(`
    CREATE TABLE weather_sources (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      code text NOT NULL UNIQUE,
      provider_type text NOT NULL CHECK (provider_type IN ('domestic','international')),
      display_name text NOT NULL,
      adapter_key text NOT NULL,
      base_url text NULL,
      config jsonb NOT NULL DEFAULT '{}',
      enabled boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE weather_api_responses (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      source_code text NOT NULL REFERENCES weather_sources(code),
      location_code text NULL,
      request_url text NULL,
      request_params jsonb NOT NULL DEFAULT '{}',
      http_status integer NULL CHECK (http_status IS NULL OR (http_status BETWEEN 100 AND 599)),
      response_body jsonb NULL,
      response_text text NULL,
      success boolean NOT NULL,
      error_code text NULL,
      error_message text NULL,
      duration_ms integer NULL CHECK (duration_ms IS NULL OR duration_ms >= 0),
      fetched_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL DEFAULT weatherops_expires_at()
    );
    CREATE INDEX idx_weather_api_responses_source_fetched
      ON weather_api_responses(source_code, fetched_at DESC);
    CREATE INDEX idx_weather_api_responses_location_fetched
      ON weather_api_responses(location_code, fetched_at DESC);

    CREATE TRIGGER weather_sources_updated_at BEFORE UPDATE ON weather_sources
      FOR EACH ROW EXECUTE FUNCTION weatherops_touch_updated_at();

    INSERT INTO weather_sources (code, provider_type, display_name, adapter_key, base_url)
    VALUES ('BMKG', 'domestic', 'Badan Meteorologi, Klimatologi, dan Geofisika', 'bmkg', NULL)
    ON CONFLICT (code) DO NOTHING;
  `);
}

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export function down(pgm) {
  pgm.sql(`
    DROP TABLE IF EXISTS weather_api_responses;
    DROP TABLE IF EXISTS weather_sources;
  `);
}