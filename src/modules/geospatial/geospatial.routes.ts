import { Router } from 'express';

import { boundary, hazardHeatmap, locations, publicMapServices, resolveLocation, search } from './geospatial.controller.js';

export const geospatialRouter = Router();
geospatialRouter.get('/map-services', publicMapServices);

export const locationsRouter = Router();
locationsRouter.get('/resolve', resolveLocation);
locationsRouter.get('/search', search);
locationsRouter.get('/heatmap', hazardHeatmap);
locationsRouter.get('/', locations);
locationsRouter.get('/:adm4/boundary', boundary);

// Kept under /geospatial for clients that group all map APIs together.
geospatialRouter.get('/locations/resolve', resolveLocation);
geospatialRouter.get('/locations/:adm4/boundary', boundary);
geospatialRouter.get('/locations/search', search);
geospatialRouter.get('/locations', locations);
geospatialRouter.get('/hazard-heatmap', hazardHeatmap);