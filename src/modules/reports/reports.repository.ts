import { createRepository, type Repository } from '../../infrastructure/database/repository.js';

export interface ReportSnapshot {
  id: string; analysis_result_id: string; locale: 'id' | 'en'; report_html: string;
  pdf_url: string | null; created_at: Date; expires_at: Date;
}
export const reportSnapshotsRepository: Repository<ReportSnapshot> = createRepository(
  'report_snapshots', ['analysis_result_id', 'locale', 'report_html', 'pdf_url'],
);