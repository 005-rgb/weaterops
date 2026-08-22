import { createRepository, type Repository } from '../../infrastructure/database/repository.js';

export interface AntiAbuseEvent {
  id: string; request_id: string | null; event_type: string; risk_score: number;
  ip_hash: string; created_at: Date; expires_at: Date;
}
export const antiAbuseEventsRepository: Repository<AntiAbuseEvent> = createRepository(
  'anti_abuse_events', ['request_id', 'event_type', 'risk_score', 'ip_hash'],
);