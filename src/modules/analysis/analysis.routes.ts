import { Router } from 'express';
import { createAnalysis } from './analysis.controller.js';
import { antiAbuseMiddleware } from '../../app/middleware/anti-abuse.js';

export const analysisRouter = Router();
analysisRouter.post('/', antiAbuseMiddleware, createAnalysis);