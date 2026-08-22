export type MapServiceProtocol = 'WMS' | 'WFS';

export interface PublicMapLayer {
  id: string;
  name: string;
  geometryType: 'polygon' | 'point' | 'unknown';
}

export interface PublicMapService {
  id: 'rainfall-and-rain-days' | 'wind-energy-potential';
  provider: 'BMKG';
  title: string;
  description: string;
  protocol: MapServiceProtocol;
  endpoint: string;
  capabilitiesUrl: string;
  queryUrl?: string;
  spatialReference: 'EPSG:4326';
  public: true;
  layers: readonly PublicMapLayer[];
}

const RAINFALL_MAP_SERVER =
  'https://gis.bmkg.go.id/arcgis/rest/services/Peta_Curah_Hujan_dan_Hari_Hujan_/MapServer';
const WIND_ENERGY_FEATURE_SERVER =
  'https://gis.bmkg.go.id/arcgis/rest/services/Hosted/Peta_Potensi_Energi_Angin/FeatureServer';

/**
 * Official public services listed in BMKG Satu Peta MKG Data API.
 * URLs are intentionally versionless ArcGIS service URLs published by BMKG.
 */
export const PUBLIC_MAP_SERVICES: readonly PublicMapService[] = [
  {
    id: 'rainfall-and-rain-days',
    provider: 'BMKG',
    title: 'Peta Curah Hujan dan Hari Hujan',
    description: 'Map service peta curah hujan dan hari hujan',
    protocol: 'WMS',
    endpoint: RAINFALL_MAP_SERVER,
    capabilitiesUrl: `${RAINFALL_MAP_SERVER}?service=WMS&request=GetCapabilities&version=1.3.0`,
    spatialReference: 'EPSG:4326',
    public: true,
    layers: [
      { id: '1', name: 'Peta Curah Hujan', geometryType: 'polygon' },
      { id: '0', name: 'Peta Hari Hujan', geometryType: 'point' },
    ],
  },
  {
    id: 'wind-energy-potential',
    provider: 'BMKG',
    title: 'Peta Potensi Energi Angin',
    description: 'Map service peta potensi energi angin',
    protocol: 'WFS',
    endpoint: WIND_ENERGY_FEATURE_SERVER,
    // BMKG catalog labels this service WFS; its public link is an ArcGIS
    // FeatureServer, so clients use the documented JSON query endpoint.
    capabilitiesUrl: `${WIND_ENERGY_FEATURE_SERVER}?f=pjson`,
    queryUrl: `${WIND_ENERGY_FEATURE_SERVER}/0/query`,
    spatialReference: 'EPSG:4326',
    public: true,
    layers: [
      { id: '0', name: 'Peta_Potensi_Energi_Angin', geometryType: 'polygon' },
    ],
  },
] as const;

export function getPublicMapServices(): readonly PublicMapService[] {
  return PUBLIC_MAP_SERVICES;
}