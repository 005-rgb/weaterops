import { createRepository, type Repository } from '../../infrastructure/database/repository.js';
import { generatePublicToken } from '../../shared/utils/public-token.js';

export interface AnalysisRequest {
  id: string; location_code: string; activity_id: string; activity_profile_code: string;
  activity_profile_version: number; scheduled_start: Date; scheduled_end: Date;
  operational_impact: unknown; point_lat: number | null; point_lng: number | null;
  session_key_hash: string | null; locale: 'id' | 'en';
  resolution_level: 'adm1' | 'adm2' | 'adm3' | 'adm4' | null; created_at: Date;
}
export interface AnalysisResult {
  id: string; analysis_request_id: string; weather_snapshot_id: string;
  decision_status: string; risk_score: number; risk_label: string; confidence: string;
  scoring_version: string; decision_engine_version: string; public_token: string;
  created_at: Date; expires_at: Date; deleted_at: Date | null;
}
export interface DecisionReason {
  id: string; analysis_result_id: string; code: string; severity: string;
  params: unknown; created_at: Date;
}
export interface Evidence {
  id: string; decision_reason_id: string; evidence_type: string; reference_id: string;
  snapshot_data: unknown; created_at: Date;
}

export const analysisRequestsRepository: Repository<AnalysisRequest> = createRepository(
  'analysis_requests',
  ['location_code', 'activity_id', 'activity_profile_code', 'activity_profile_version',
    'scheduled_start', 'scheduled_end', 'operational_impact', 'point_lat', 'point_lng',
    'session_key_hash', 'locale', 'resolution_level'],
);
const analysisResultsBaseRepository: Repository<AnalysisResult> = createRepository(
  'analysis_results',
  ['analysis_request_id', 'weather_snapshot_id', 'decision_status', 'risk_score', 'risk_label',
    'confidence', 'scoring_version', 'decision_engine_version', 'public_token', 'deleted_at'],
);
export const analysisResultsRepository: Repository<AnalysisResult> = {
  ...analysisResultsBaseRepository,
  create(data) {
    return analysisResultsBaseRepository.create({
      ...data,
      public_token: data.public_token ?? generatePublicToken(),
    });
  },
};
export const decisionReasonsRepository: Repository<DecisionReason> = createRepository(
  'decision_reasons', ['analysis_result_id', 'code', 'severity', 'params'],
);
export const evidenceRepository: Repository<Evidence> = createRepository(
  'evidence', ['decision_reason_id', 'evidence_type', 'reference_id', 'snapshot_data'],
);