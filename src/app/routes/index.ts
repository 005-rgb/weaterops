import { Router } from 'express';

import { geospatialRouter } from '../../modules/geospatial/geospatial.routes.js';
import { systemRouter } from '../../modules/system/system.routes.js';

export const apiRouter = Router();
apiRouter.use('/system', systemRouter);
apiRouter.use('/geospatial', geospatialRouter);