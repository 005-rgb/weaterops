import type { RequestHandler } from 'express';
import { generatePdf, getOrCreateReport } from './reports.service.js';

function tokenFrom(request: Parameters<RequestHandler>[0]): string {
  const token = request.params.publicToken;
  return Array.isArray(token) ? token[0] : token;
}

export const getReport: RequestHandler = async (request, response, next) => {
  try {
    const html = await getOrCreateReport(tokenFrom(request));
    response.type('html').send(html);
  } catch (error) {
    next(error);
  }
};

export const createPdf: RequestHandler = async (request, response, next) => {
  try {
    const pdfUrl = await generatePdf(tokenFrom(request));
    response.json({ pdfUrl });
  } catch (error) {
    next(error);
  }
};