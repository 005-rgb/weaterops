import { Router } from 'express';
import { createAnalysis } from './analysis.controller.js';

export const analysisRouter = Router();
analysisRouter.post('/', createAnalysis);