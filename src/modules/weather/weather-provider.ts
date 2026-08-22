import type { CanonicalWeatherSlot } from './weather.types.js';

/**
 * Stable contract for adding a domestic or international weather API.
 * Each provider owns its upstream schema and converts it to this canonical model.
 */
export interface WeatherProvider<TResponse = unknown> {
  readonly sourceCode: string;
  readonly providerType: 'domestic' | 'international';
  fetchForecast(locationCode: string): Promise<TResponse>;
  normalizeForecast(response: TResponse, locationCode: string): CanonicalWeatherSlot[];
  getSourceUpdatedAt?(response: TResponse): Date | null;
}