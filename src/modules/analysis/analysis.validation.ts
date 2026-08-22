import { z } from 'zod';

const operationalImpactSchema = z.object({
  impactMultiplier: z.number().finite().positive().max(10).optional(),
}).passthrough();

export const analysisInputSchema = z.object({
  locationCode: z.string().trim().min(1),
  activityCode: z.string().trim().min(1),
  scheduledStart: z.string().datetime({ offset: true }),
  scheduledEnd: z.string().datetime({ offset: true }),
  operationalImpact: operationalImpactSchema,
}).superRefine((value, context) => {
  if (Date.parse(value.scheduledEnd) <= Date.parse(value.scheduledStart)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['scheduledEnd'],
      message: 'scheduledEnd must be after scheduledStart',
    });
  }
});

export type AnalysisInput = z.infer<typeof analysisInputSchema>;