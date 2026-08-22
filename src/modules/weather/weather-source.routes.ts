import { Router } from 'express';
import { z } from 'zod';

import { weatherSourcesRepository } from './weather.repository.js';

const sourceSchema = z.object({
  code: z.string().trim().min(1).max(80).regex(/^[A-Z0-9_-]+$/),
  provider_type: z.enum(['domestic', 'international']),
  display_name: z.string().trim().min(1).max(200),
  adapter_key: z.string().trim().min(1).max(80).regex(/^[a-z0-9_-]+$/),
  base_url: z.string().url().nullable().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  enabled: z.boolean().optional(),
});

export const weatherSourceRouter = Router();

weatherSourceRouter.get('/', async (_request, response, next) => {
  try {
    response.json(await weatherSourcesRepository.findMany());
  } catch (error) {
    next(error);
  }
});

weatherSourceRouter.post('/', async (request, response, next) => {
  try {
    const data = sourceSchema.parse(request.body);
    response.status(201).json(await weatherSourcesRepository.create(data));
  } catch (error) {
    next(error);
  }
});

weatherSourceRouter.patch('/:id', async (request, response, next) => {
  try {
    const source = await weatherSourcesRepository.findById(request.params.id);
    if (!source) {
      response.status(404).json({ error: { code: 'SOURCE_NOT_FOUND', message: 'Weather source not found' } });
      return;
    }
    const data = sourceSchema.partial().parse(request.body);
    const updated = await weatherSourcesRepository.update(request.params.id, data);
    response.json(updated);
  } catch (error) {
    next(error);
  }
});

weatherSourceRouter.delete('/:id', async (request, response, next) => {
  try {
    const source = await weatherSourcesRepository.update(request.params.id, { enabled: false });
    if (!source) {
      response.status(404).json({ error: { code: 'SOURCE_NOT_FOUND', message: 'Weather source not found' } });
      return;
    }
    response.json({ ...source, deleted: true, note: 'Source disabled; API history was preserved' });
  } catch (error) {
    next(error);
  }
});