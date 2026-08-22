import { Router } from 'express';
import { createPdf, getReport } from './reports.controller.js';

export const reportsRouter = Router();
reportsRouter.get('/:publicToken', getReport);
reportsRouter.post('/:publicToken/report.pdf', createPdf);