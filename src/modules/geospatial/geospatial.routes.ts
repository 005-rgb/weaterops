import { Router } from 'express';

import { publicMapServices } from './geospatial.controller.js';

export const geospatialRouter = Router();
geospatialRouter.get('/map-services', publicMapServices);