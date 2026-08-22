import type { RequestHandler } from 'express';
import { analysisInputSchema } from './analysis.validation.js';
import { analysisService } from './analysis.service.js';
import { ApiError } from '../../shared/errors/error-codes.js';

export const createAnalysis: RequestHandler = async (request, response, next) => {
  try {
    const input = analysisInputSchema.parse(request.body);
    const result = await analysisService.create({ ...input, locale: request.locale, sessionKeyHash: request.sessionKeyHash });
    response.status(201).json(result);
  } catch (error) {
    if (error instanceof ApiError || error instanceof SyntaxError) {
      next(error);
      return;
    }
    next(error);
  }
};