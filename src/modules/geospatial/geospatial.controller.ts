import type { RequestHandler } from 'express';

import { getPublicMapServices } from './map-services.js';

export const publicMapServices: RequestHandler = (_request, response) => {
  response.json({
    provider: 'BMKG',
    coordinateReferenceSystem: 'EPSG:4326',
    services: getPublicMapServices(),
  });
};