import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../../shared/errors/error-codes.js';

export const errorHandler: ErrorRequestHandler = (error, _request, response, next) => {
  void next;
  console.error(
    JSON.stringify({
      level: 'error',
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error',
    }),
  );
  if (error instanceof ApiError) {
    response.status(error.statusCode).json({
      error: { code: error.code, message: error.message, ...(error.details === undefined ? {} : { details: error.details }) },
    });
    return;
  }
  if (error instanceof ZodError) {
    response.status(400).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Request validation failed',
        details: error.flatten(),
      },
    });
    return;
  }
  if (error instanceof SyntaxError && 'statusCode' in error && error.statusCode === 400) {
    response.status(400).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Request body contains invalid JSON',
      },
    });
    return;
  }
  response.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    },
  });
};