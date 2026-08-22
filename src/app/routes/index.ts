import { Router } from 'express';

import { systemRouter } from '../../modules/system/system.routes.js';

export const apiRouter = Router();
apiRouter.use('/system', systemRouter);