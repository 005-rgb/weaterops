import { createRepository, type Repository } from '../../infrastructure/database/repository.js';

export interface SessionBoard {
  id: string; session_key_hash: string; label: string | null; created_at: Date;
  last_seen_at: Date; expires_at: Date;
}
export const sessionBoardsRepository: Repository<SessionBoard> = createRepository(
  'session_boards', ['session_key_hash', 'label', 'last_seen_at', 'expires_at'],
);