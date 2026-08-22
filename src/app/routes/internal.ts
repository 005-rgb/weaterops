import { Router } from 'express';
import { internalOnly } from '../middleware/internal-only.js';
import { getTraceTimeline } from '../../modules/system/traces.controller.js';

export const internalRouter = Router();
internalRouter.use(internalOnly);
internalRouter.get('/traces/:analysisId', getTraceTimeline);