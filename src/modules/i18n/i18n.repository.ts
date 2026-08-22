import { createRepository, type Repository } from '../../infrastructure/database/repository.js';

export interface TranslationCatalogEntry {
  id: string; code: string; locale: 'id' | 'en'; template: string;
  reviewed_by_human: boolean; created_at: Date; updated_at: Date;
}
export const translationCatalogRepository: Repository<TranslationCatalogEntry> = createRepository(
  'translation_catalog', ['code', 'locale', 'template', 'reviewed_by_human'],
);