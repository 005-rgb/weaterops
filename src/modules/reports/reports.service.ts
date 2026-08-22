import { pool, withTransaction } from '../../infrastructure/database/client.js';
import { ApiError } from '../../shared/errors/error-codes.js';

interface ReportReason {
  code: string;
  severity: string;
  params: Record<string, unknown>;
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

// Temporary ID-only lookup. Fase 5 replaces this with translation_catalog.
const REASON_LABELS: Record<string, string> = {
  CLEAR_CONDITIONS_PROCEED: 'Kondisi cuaca mendukung pelaksanaan.',
  HEAVY_RAIN_CRITICAL_SLOT: 'Hujan lebat terdeteksi pada slot kritis.',
  CRITICAL_WINDOW_RAIN_RISK: 'Terdapat risiko hujan pada jendela kritis.',
  UNKNOWN_WEATHER_LOW_CONFIDENCE: 'Data cuaca tidak dikenal menurunkan keyakinan.',
  INCOMPLETE_SLOT_COVERAGE: 'Cakupan slot prakiraan tidak lengkap.',
  ALTERNATIVE_WINDOW_AVAILABLE: 'Tersedia jendela waktu alternatif.',
};

function escapeHtml(value: unknown): string {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character] ?? character));
}

function renderHtml(data: ReportData): string {
  const reasons = data.reasons.map((reason) => `<li><strong>${escapeHtml(reason.severity)}</strong>: ${
    escapeHtml(REASON_LABELS[reason.code] ?? reason.code)
  }</li>`).join('');
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>WeatherOps Report</title>
<style>body{font-family:Arial,sans-serif;max-width:760px;margin:40px auto;color:#18212f}h1{color:#125b8c}.summary{border:1px solid #ccd6e0;padding:20px;border-radius:8px}li{margin:8px 0}.disclaimer{margin-top:32px;color:#5d6875;font-size:small}</style></head>
<body><h1>WeatherOps Operational Weather Report</h1><div class="summary">
<p><strong>Decision:</strong> ${escapeHtml(data.status)}</p><p><strong>Risk score:</strong> ${escapeHtml(data.riskScore)}</p>
<p><strong>Risk label:</strong> ${escapeHtml(data.riskLabel)}</p><p><strong>Confidence:</strong> ${escapeHtml(data.confidence)}</p>
<p><strong>Analysis time:</strong> ${escapeHtml(data.createdAt.toISOString())}</p></div>
<h2>Reasons</h2><ul>${reasons || '<li>No additional reasons.</li>'}</ul>
<p class="disclaimer">// TODO Fase 11: ganti dengan disclaimer final hasil review hukum. Informasi ini adalah bantuan operasional, bukan jaminan kondisi cuaca.</p>
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
  if (new Date(row.expires_at).getTime() <= new Date().getTime()) {
    throw new ApiError('REPORT_EXPIRED', 'Report has expired', 410);
  }
  return {
    resultId: row.result_id,
    token: row.public_token,
    status: row.decision_status,
    riskScore: row.risk_score,
    riskLabel: row.risk_label,
    confidence: row.confidence,
    createdAt: new Date(row.created_at),
    expiresAt: new Date(row.expires_at),
    reasons: row.reasons as ReportReason[],
  };
}

export async function getOrCreateReport(token: string): Promise<string> {
  const data = await loadReport(token);
  const existing = await pool.query(
    `SELECT report_html FROM report_snapshots
     WHERE analysis_result_id = $1 AND locale = 'id'
     ORDER BY created_at ASC LIMIT 1`,
    [data.resultId],
  );
  if (existing.rows[0]) return existing.rows[0].report_html;
  const html = renderHtml(data);
  await pool.query(
    `INSERT INTO report_snapshots (analysis_result_id, locale, report_html)
     VALUES ($1, 'id', $2)`,
    [data.resultId, html],
  );
  return html;
}

export async function generatePdf(token: string): Promise<string> {
  const html = await getOrCreateReport(token);
  const data = await loadReport(token);
  // Minimal synchronous placeholder; Fase 10 can replace this with a real renderer.
  const pdf = `%PDF-1.4\n% WeatherOps placeholder\n${html.slice(0, 400)}\n%%EOF`;
  const pdfUrl = `data:application/pdf;base64,${Buffer.from(pdf).toString('base64')}`;
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE report_snapshots SET pdf_url = $1
       WHERE analysis_result_id = $2 AND locale = 'id'`,
      [pdfUrl, data.resultId],
    );
  });
  return pdfUrl;
}