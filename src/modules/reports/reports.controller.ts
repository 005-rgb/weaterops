import type { RequestHandler } from 'express';
import { generatePdf, getOrCreateReport, loadReport } from './reports.service.js';

function tokenFrom(request: Parameters<RequestHandler>[0]): string {
  const token = request.params.publicToken;
  return Array.isArray(token) ? token[0] : token;
}

export const getReport: RequestHandler = async (request, response, next) => {
  try {
    if (request.query.format === 'json') {
      const report = await loadReport(tokenFrom(request));
      response.json(report);
      return;
    }
    const html = await getOrCreateReport(tokenFrom(request), request.locale);
    response.type('html').send(html);
  } catch (error) {
    next(error);
  }
};

export const createPdf: RequestHandler = async (request, response, next) => {
  try {
    const pdfUrl = await generatePdf(tokenFrom(request), request.locale);
    response.json({ pdfUrl });
  } catch (error) {
    next(error);
  }
};