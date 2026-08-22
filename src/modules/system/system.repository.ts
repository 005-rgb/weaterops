import { createRepository, type Repository } from '../../infrastructure/database/repository.js';

export interface SystemEvent {
  id: string; trace_id: string | null; event_type: string; payload: unknown;
  created_at: Date; expires_at: Date;
}
export const systemEventsRepository: Repository<SystemEvent> = createRepository(
  'system_events', ['trace_id', 'event_type', 'payload'],
);