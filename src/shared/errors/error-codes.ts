export const ERROR_CODES = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  LOCATION_NOT_FOUND: 'LOCATION_NOT_FOUND',
  ACTIVITY_NOT_FOUND: 'ACTIVITY_NOT_FOUND',
  WEATHER_SOURCE_UNAVAILABLE: 'WEATHER_SOURCE_UNAVAILABLE',
  BMKG_SCHEMA_VALIDATION_FAILED: 'BMKG_SCHEMA_VALIDATION_FAILED',
  REPORT_NOT_FOUND: 'REPORT_NOT_FOUND',
  REPORT_EXPIRED: 'REPORT_EXPIRED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  LOCATION_RESOLUTION_FAILED: 'LOCATION_RESOLUTION_FAILED',
  BOUNDARY_UNAVAILABLE: 'BOUNDARY_UNAVAILABLE',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

export class ApiError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}