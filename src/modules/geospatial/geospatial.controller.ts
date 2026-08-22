import type { RequestHandler } from 'express';

import { getPublicMapServices } from './map-services.js';
import { ApiError } from '../../shared/errors/error-codes.js';
import { env } from '../../app/config/env.js';
import { getBoundary, getHazardHeatmap, listLocations, resolvePoint, searchLocations } from './geospatial.repository.js';

export const publicMapServices: RequestHandler = (_request, response) => {
  response.json({
    provider: 'BMKG',
    coordinateReferenceSystem: 'EPSG:4326',
    services: getPublicMapServices(),
  });
};

function numberParam(value: unknown, name: string, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new ApiError('VALIDATION_FAILED', `${name} must be between ${min} and ${max}`, 400);
  }
  return parsed;
}

export const resolveLocation: RequestHandler = async (request, response, next) => {
  try {
    const lat = numberParam(request.query.lat, 'lat', -90, 90);
    const lng = numberParam(request.query.lng, 'lng', -180, 180);
    const location = await resolvePoint(lat, lng);
    if (!location) throw new ApiError('LOCATION_RESOLUTION_FAILED', 'No boundary contains this point', 404);
    response.json({
      locationCode: location.code, name: location.name, fullName: location.fullName,
      resolutionLevel: location.level,
    });
  } catch (error) { next(error); }
};

export const boundary: RequestHandler = async (request, response, next) => {
  try {
    const adm4 = Array.isArray(request.params.adm4) ? request.params.adm4[0] : request.params.adm4;
    const result = await getBoundary(adm4, env.BOUNDARY_SIMPLIFY_TOLERANCE);
    if (!result) throw new ApiError('BOUNDARY_UNAVAILABLE', 'Boundary is unavailable for this location', 404);
    response.json({
      type: 'Feature', geometry: result.geojson,
      properties: { code: result.code, name: result.name, fullName: result.fullName,
        level: result.level, boundarySource: result.boundarySource },
    });
  } catch (error) { next(error); }
};

export const search: RequestHandler = async (request, response, next) => {
  try {
    const query = String(request.query.q ?? '').trim();
    if (query.length < 2) throw new ApiError('VALIDATION_FAILED', 'q must contain at least 2 characters', 400);
    const lat = request.query.viewportLat === undefined ? undefined : numberParam(request.query.viewportLat, 'viewportLat', -90, 90);
    const lng = request.query.viewportLng === undefined ? undefined : numberParam(request.query.viewportLng, 'viewportLng', -180, 180);
    const rows = await searchLocations(query, lat, lng);
    response.json(rows.map((row) => ({ code: row.code, name: row.name, fullName: row.fullName, level: row.level })));
  } catch (error) { next(error); }
};

export const locations: RequestHandler = async (request, response, next) => {
  try {
    const level = String(request.query.level ?? '');
    if (!['adm1', 'adm2', 'adm3', 'adm4'].includes(level)) {
      throw new ApiError('VALIDATION_FAILED', 'level must be adm1, adm2, adm3, or adm4', 400);
    }
    const rows = await listLocations(level as 'adm1' | 'adm2' | 'adm3' | 'adm4', request.query.parentCode?.toString());
    response.json(rows.map((row) => ({ code: row.code, name: row.name, fullName: row.fullName, level: row.level })));
  } catch (error) { next(error); }
};

export const hazardHeatmap: RequestHandler = async (request, response, next) => {
  try {
    const values = String(request.query.bounds ?? '').split(',').map(Number);
    if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) {
      throw new ApiError('VALIDATION_FAILED', 'bounds must be west,south,east,north', 400);
    }
    response.json({ type: 'FeatureCollection', features: (await getHazardHeatmap(values as [number, number, number, number])).map((row) => ({
      type: 'Feature', geometry: { type: 'Point', coordinates: [row.longitude, row.latitude] },
      properties: { code: row.code, name: row.name, hazardScore: row.hazardScore },
    })) });
  } catch (error) { next(error); }
};