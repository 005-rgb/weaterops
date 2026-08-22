import { describe, expect, it } from 'vitest';

import { getPublicMapServices } from '../src/modules/geospatial/map-services.js';
import { createApp } from '../src/app.js';
import request from 'supertest';

describe('public BMKG map services', () => {
  it('registers the official rainfall WMS and wind WFS services', () => {
    const services = getPublicMapServices();
    expect(services).toHaveLength(2);
    expect(services).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'rainfall-and-rain-days', protocol: 'WMS', public: true }),
      expect.objectContaining({ id: 'wind-energy-potential', protocol: 'WFS', public: true }),
    ]));
    expect(services[0].layers).toEqual([
      expect.objectContaining({ id: '1', name: 'Peta Curah Hujan' }),
      expect.objectContaining({ id: '0', name: 'Peta Hari Hujan' }),
    ]);
  });

  it('exposes the registry through the API', async () => {
    const response = await request(createApp()).get('/api/v1/geospatial/map-services');
    expect(response.status).toBe(200);
    expect(response.body.services).toHaveLength(2);
    expect(response.body.coordinateReferenceSystem).toBe('EPSG:4326');
  });
});