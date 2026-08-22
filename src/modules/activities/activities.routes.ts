import { Router } from 'express';
import { pool } from '../../infrastructure/database/client.js';

export const activitiesRouter = Router();

activitiesRouter.get('/', async (request, response, next) => {
  try {
    const locale = request.locale === 'en' ? 'en' : 'id';
    const nameColumn = locale === 'en' ? 'a.name_en' : 'a.name_id';
    const result = await pool.query(
      `SELECT a.activity_profile_code AS code, ${nameColumn} AS name,
              a.name_id AS "nameId", a.name_en AS "nameEn",
              a.active, p.hazard_sensitivity AS "hazardSensitivity"
       FROM activities a
       JOIN activity_profiles p ON p.code = a.activity_profile_code AND p.active = true
       WHERE a.active = true
       ORDER BY a.created_at`,
    );
    response.json(result.rows);
  } catch (error) {
    next(error);
  }
});