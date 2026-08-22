import type { WeatherDescCode } from '../weather/weather.types.js';

export type HazardCode = WeatherDescCode | 'UNKNOWN';

export interface HazardSensitivity {
  hazardWeights: Record<HazardCode, number>;
  criticalWindowHours: number;
  minAcceptableConfidence: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface ActivityProfile {
  code: string;
  version: number;
  name: string;
  hazardSensitivity: HazardSensitivity;
}

const allHazards = (defaultWeight: number): Record<HazardCode, number> => ({
  CERAH: defaultWeight,
  CERAH_BERAWAN: defaultWeight,
  BERAWAN: defaultWeight,
  BERAWAN_TEBAL: defaultWeight,
  HUJAN_RINGAN: defaultWeight,
  HUJAN_SEDANG: defaultWeight,
  HUJAN_LEBAT: defaultWeight,
  HUJAN_PETIR: defaultWeight,
  HUJAN_LOKAL: defaultWeight,
  KABUT: defaultWeight,
  ASAP: defaultWeight,
  UDARA_KABUR: defaultWeight,
  UNKNOWN: defaultWeight,
});

export const ACTIVITY_PROFILES: Record<string, ActivityProfile> = {
  CONCRETE_POUR: {
    code: 'CONCRETE_POUR',
    version: 1,
    name: 'Concrete Pour',
    hazardSensitivity: {
      hazardWeights: {
        ...allHazards(0.2),
        HUJAN_RINGAN: 0.65,
        HUJAN_SEDANG: 0.9,
        HUJAN_LEBAT: 1,
        HUJAN_PETIR: 1,
        HUJAN_LOKAL: 0.85,
        UNKNOWN: 0.9,
      },
      criticalWindowHours: 6,
      minAcceptableConfidence: 'MEDIUM',
    },
  },
  EARTHWORK: {
    code: 'EARTHWORK',
    version: 1,
    name: 'Earthwork',
    hazardSensitivity: {
      hazardWeights: { ...allHazards(0.15), HUJAN_SEDANG: 0.7, HUJAN_LEBAT: 0.8, HUJAN_PETIR: 0.8, UNKNOWN: 0.6 },
      criticalWindowHours: 2,
      minAcceptableConfidence: 'LOW',
    },
  },
  ROOFING: {
    code: 'ROOFING',
    version: 1,
    name: 'Roofing',
    hazardSensitivity: {
      hazardWeights: { ...allHazards(0.1), HUJAN_SEDANG: 0.65, HUJAN_LEBAT: 0.95, HUJAN_PETIR: 1, UNKNOWN: 0.5 },
      criticalWindowHours: 1,
      minAcceptableConfidence: 'MEDIUM',
    },
  },
};