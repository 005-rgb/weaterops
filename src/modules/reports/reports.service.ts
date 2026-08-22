import { pool, withTransaction } from '../../infrastructure/database/client.js';
import { ApiError } from '../../shared/errors/error-codes.js';
import { resolveText, type Locale } from '../i18n/i18n.service.js';

interface ReportReason {
  code: string;
  severity: string;
  params: Record<string, string | number>;
}

interface ReportData {
  resultId: string;
  token: string;
  status: string;
  riskScore: number;
  riskLabel: string;
  confidence: string;
  createdAt: Date;
  expiresAt: Date;
  reasons: ReportReason[];
}

function escapeHtml(value: unknown): string {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character] ?? character));
}

async function renderHtml(data: ReportData, locale: Locale): Promise<string> {
  const [title, decision, riskScore, riskLabel, confidence, analysisTime, reasonsTitle, noReasons, disclaimer] =
    await Promise.all([
      resolveText('label.weather_report', locale), resolveText('label.decision', locale),
      resolveText('label.risk_score', locale), resolveText('label.risk_label', locale),
      resolveText('label.confidence', locale), resolveText('label.analysis_time', locale),
      resolveText('label.reasons', locale), resolveText('label.no_reasons', locale),
      resolveText('label.disclaimer', locale),
    ]);
  const reasonItems = await Promise.all(data.reasons.map(async (reason) =>
    `<li><strong>${escapeHtml(reason.severity)}</strong>: ${
      escapeHtml(await resolveText(reason.code, locale, reason.params))
    }</li>`));
  const language = locale;
  return `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
 <style>body{font-family:Arial,sans-serif;max-width:760px;margin:40px auto;color:#18212f}h1{color:#125b8c}.summary{border:1px solid #ccd6e0;padding:20px;border-radius:8px}li{margin:8px 0}.disclaimer{margin-top:32px;color:#5d6875;font-size:small}</style></head>
 <body><h1>${escapeHtml(title)}</h1><div class="summary">
 <p><strong>${escapeHtml(decision)}:</strong> ${escapeHtml(await resolveText(`status.${data.status}`, locale))}</p>
 <p><strong>${escapeHtml(riskScore)}:</strong> ${escapeHtml(data.riskScore)}</p>
 <p><strong>${escapeHtml(riskLabel)}:</strong> ${escapeHtml(data.riskLabel)}</p>
 <p><strong>${escapeHtml(confidence)}:</strong> ${escapeHtml(data.confidence)}</p>
 <p><strong>${escapeHtml(analysisTime)}:</strong> ${escapeHtml(data.createdAt.toISOString())}</p></div>
 <h2>${escapeHtml(reasonsTitle)}</h2><ul>${reasonItems.join('') || `<li>${escapeHtml(noReasons)}</li>`}</ul>
 <p class="disclaimer">${escapeHtml(disclaimer)}</p>
 </body></html>`;
}

async function loadReport(token: string): Promise<ReportData> {
  const result = await pool.query(
    `SELECT ar.id AS result_id, ar.public_token, ar.decision_status, ar.risk_score,
            ar.risk_label, ar.confidence, ar.created_at, ar.expires_at, ar.deleted_at,
            COALESCE(json_agg(json_build_object('code', dr.code, 'severity', dr.severity,
              'params', dr.params) ORDER BY dr.created_at) FILTER (WHERE dr.id IS NOT NULL), '[]') AS reasons
     FROM analysis_results ar
     LEFT JOIN decision_reasons dr ON dr.analysis_result_id = ar.id
     WHERE ar.public_token = $1
     GROUP BY ar.id`,
    [token],
  );
  const row = result.rows[0];
  if (!row || row.deleted_at) throw new ApiError('REPORT_NOT_FOUND', 'Report was not found', 404);
  if (new Date(row.expires_at).getTime() <= Date.now()) throw new ApiError('REPORT_EXPIRED', 'Report has expired', 410);
  return {
    resultId: row.result_id, token: row.public_token, status: row.decision_status,
    riskScore: row.risk_score, riskLabel: row.risk_label, confidence: row.confidence,
    createdAt: new Date(row.created_at), expiresAt: new Date(row.expires_at),
    reasons: row.reasons as ReportReason[],
  };
}

export async function getOrCreateReport(token: string, locale: Locale = 'id'): Promise<string> {
  const data = await loadReport(token);
  const existing = await pool.query(
    `SELECT report_html FROM report_snapshots
     WHERE analysis_result_id = $1 AND locale = $2 ORDER BY created_at ASC LIMIT 1`,
    [data.resultId, locale],
  );
  if (existing.rows[0]) return existing.rows[0].report_html;
  const html = await renderHtml(data, locale);
  await pool.query(
    `INSERT INTO report_snapshots (analysis_result_id, locale, report_html)
     VALUES ($1, $2, $3) ON CONFLICT (analysis_result_id, locale) DO NOTHING`,
    [data.resultId, locale, html],
  );
  const saved = await pool.query(
    'SELECT report_html FROM report_snapshots WHERE analysis_result_id = $1 AND locale = $2',
    [data.resultId, locale],
  );
  return saved.rows[0]?.report_html ?? html;
}

export async function generatePdf(token: string, locale: Locale = 'id'): Promise<string> {
  const html = await getOrCreateReport(token, locale);
  const data = await loadReport(token);
  const pdf = `%PDF-1.4\n% WeatherOps placeholder\n${html.slice(0, 400)}\n%%EOF`;
  const pdfUrl = `data:application/pdf;base64,${Buffer.from(pdf).toString('base64')}`;
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE report_snapshots SET pdf_url = $1
       WHERE analysis_result_id = $2 AND locale = $3 AND pdf_url IS NULL`,
      [pdfUrl, data.resultId, locale],
    );
  });
  return pdfUrl;
}