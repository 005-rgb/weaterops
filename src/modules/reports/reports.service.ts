import { pool, withTransaction } from '../../infrastructure/database/client.js';
import { ApiError } from '../../shared/errors/error-codes.js';
import { resolveText, type Locale } from '../i18n/i18n.service.js';
import { withSpan } from '../../infrastructure/tracing/setup.js';

interface ReportReason {
  code: string;
  severity: string;
  params: Record<string, string | number>;
}

interface ReportEvidence {
  referenceId: string;
  snapshotData: Record<string, unknown>;
}

export interface ReportData {
  resultId: string;
  token: string;
  status: string;
  riskScore: number;
  riskLabel: string;
  confidence: string;
  location: { code: string; name: string; fullName: string };
  activity: { code: string; nameId: string; nameEn: string };
  scheduledStart: Date;
  scheduledEnd: Date;
  weather: {
    source: string;
    fetchedAt: Date;
    sourceUpdatedAt: Date | null;
    slots: Array<Record<string, unknown>>;
  };
  alternativeWindows: Array<{ window: { start: string; end: string }; riskScore: number; riskLabel: string }>;
  scoringVersion: string;
  decisionEngineVersion: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  expiresAt: Date;
  reasons: ReportReason[];
  evidence: ReportEvidence[];
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
    `<li><strong>${escapeHtml(await resolveText(`severity.${reason.severity}`, locale))}</strong>: ${
      escapeHtml(await resolveText(reason.code, locale, reason.params))
    }</li>`));
  const slotItems = data.weather.slots.map((slot) =>
    `<tr><td>${escapeHtml(slot.localDatetime ?? '—')}</td><td>${escapeHtml(slot.weatherDesc ?? '—')}</td><td>${escapeHtml(slot.weatherDescNormalized ?? 'UNKNOWN')}</td><td>${escapeHtml(slot.temperatureC ?? '—')}°C</td><td>${escapeHtml(slot.windSpeedMs ?? '—')} m/s</td></tr>`).join('');
  const alternativeItems = data.alternativeWindows.map((item) =>
    `<li>${escapeHtml(item.window.start)} — ${escapeHtml(item.window.end)} · ${escapeHtml(item.riskLabel)} (${escapeHtml(item.riskScore)}/100)</li>`).join('');
  const age = data.metadata.snapshotAgeMinutes;
  const coverage = data.metadata.slotCoverage as { complete?: boolean; ratio?: number } | undefined;
  const language = locale;
  return `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title>
 <style>:root{font-family:Arial,sans-serif;color:#edf1ff;background:#080b17;--surface:#0e1221;--line:#343b5b;--muted:#aab2cf;--accent:#92a7ff;--green:#77e5bf}body{max-width:900px;margin:0 auto;padding:40px 24px;background:#080b17;color:#edf1ff}h1{font-size:32px;letter-spacing:-.04em}.summary,.section{border:1px solid var(--line);padding:24px;border-radius:16px;background:var(--surface);margin:18px 0}.summary strong,h2{color:var(--accent)}li{margin:10px 0}.muted{color:var(--muted)}table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:8px;border-bottom:1px solid var(--line)}.disclaimer{margin-top:32px;padding:16px;border-left:3px solid #b79aff;color:var(--muted);font-size:small;line-height:1.6}.risk{font-size:24px;color:var(--green)}</style></head>
 <body><h1>${escapeHtml(title)}</h1><div class="summary">
  <p class="muted">${escapeHtml(data.location.fullName)} · ${escapeHtml(data.activity.nameId)} / ${escapeHtml(data.activity.nameEn)}</p>
 <p><strong>${escapeHtml(decision)}:</strong> ${escapeHtml(await resolveText(`status.${data.status}`, locale))}</p>
 <p><strong>${escapeHtml(riskScore)}:</strong> ${escapeHtml(data.riskScore)}</p>
 <p><strong>${escapeHtml(riskLabel)}:</strong> ${escapeHtml(await resolveText(`risk.${data.riskLabel}`, locale))}</p>
 <p><strong>${escapeHtml(confidence)}:</strong> ${escapeHtml(await resolveText(`confidence.${data.confidence}`, locale))}</p>
  <p><strong>${escapeHtml(analysisTime)}:</strong> ${escapeHtml(data.createdAt.toISOString())}</p>
  <p><strong>Window:</strong> ${escapeHtml(data.scheduledStart.toISOString())} — ${escapeHtml(data.scheduledEnd.toISOString())}</p>
  <p><strong>Data freshness:</strong> ${escapeHtml(age ?? 'unavailable')} minutes · coverage ${escapeHtml(coverage?.ratio ?? 0)} · ${coverage?.complete ? 'complete' : 'incomplete'}</p>
  <p class="muted">Scoring ${escapeHtml(data.scoringVersion)} · Engine ${escapeHtml(data.decisionEngineVersion)} · Source ${escapeHtml(data.weather.source)}</p></div>
  <div class="section"><h2>${escapeHtml(reasonsTitle)}</h2><ul>${reasonItems.join('') || `<li>${escapeHtml(noReasons)}</li>`}</ul></div>
  <div class="section"><h2>Weather evidence</h2><p class="muted">Fetched ${escapeHtml(data.weather.fetchedAt.toISOString())}; source updated ${escapeHtml(data.weather.sourceUpdatedAt?.toISOString() ?? 'unknown')}</p><table><thead><tr><th>Time</th><th>Description</th><th>Normalized</th><th>Temperature</th><th>Wind</th></tr></thead><tbody>${slotItems || '<tr><td colspan="5">No dated forecast slots</td></tr>'}</tbody></table></div>
  ${alternativeItems ? `<div class="section"><h2>Alternative windows</h2><ul>${alternativeItems}</ul></div>` : ''}
 <p class="disclaimer">${escapeHtml(disclaimer)}</p>
 </body></html>`;
}

export async function loadReport(token: string): Promise<ReportData> {
  const result = await pool.query(
    `SELECT ar.id AS result_id, ar.public_token, ar.decision_status, ar.risk_score,
            ar.risk_label, ar.confidence, ar.scoring_version, ar.decision_engine_version,
            ar.metadata, ar.created_at, ar.expires_at, ar.deleted_at,
            req.scheduled_start, req.scheduled_end,
            loc.code AS location_code, loc.name AS location_name, loc.full_name AS location_full_name,
            act.activity_profile_code, act.name_id, act.name_en,
            ws.source AS weather_source, ws.fetched_at AS weather_fetched_at,
            ws.source_updated_at, ws.normalized_data
     FROM analysis_results ar
     JOIN analysis_requests req ON req.id = ar.analysis_request_id
     JOIN locations loc ON loc.code = req.location_code
     JOIN activities act ON act.id = req.activity_id
     JOIN weather_snapshots ws ON ws.id = ar.weather_snapshot_id
     WHERE ar.public_token = $1`,
    [token],
  );
  const row = result.rows[0];
  if (!row || row.deleted_at) throw new ApiError('REPORT_NOT_FOUND', 'Report was not found', 404);
  if (new Date(row.expires_at).getTime() <= Date.now()) throw new ApiError('REPORT_EXPIRED', 'Report has expired', 410);
  const [reasons, evidence] = await Promise.all([
    pool.query(
      `SELECT code, severity, params FROM decision_reasons
       WHERE analysis_result_id = $1 ORDER BY created_at ASC`,
      [row.result_id],
    ),
    pool.query(
      `SELECT e.reference_id, e.snapshot_data
       FROM evidence e JOIN decision_reasons dr ON dr.id = e.decision_reason_id
       WHERE dr.analysis_result_id = $1 ORDER BY e.created_at ASC`,
      [row.result_id],
    ),
  ]);
  const metadata = (row.metadata ?? {}) as Record<string, unknown>;
  return {
    resultId: row.result_id, token: row.public_token, status: row.decision_status,
    riskScore: row.risk_score, riskLabel: row.risk_label, confidence: row.confidence,
    location: { code: row.location_code, name: row.location_name, fullName: row.location_full_name },
    activity: { code: row.activity_profile_code, nameId: row.name_id, nameEn: row.name_en },
    scheduledStart: new Date(row.scheduled_start), scheduledEnd: new Date(row.scheduled_end),
    weather: {
      source: row.weather_source, fetchedAt: new Date(row.weather_fetched_at),
      sourceUpdatedAt: row.source_updated_at ? new Date(row.source_updated_at) : null,
      slots: Array.isArray(row.normalized_data) ? row.normalized_data : [],
    },
    alternativeWindows: Array.isArray(metadata.alternativeWindows) ? metadata.alternativeWindows as ReportData['alternativeWindows'] : [],
    scoringVersion: row.scoring_version, decisionEngineVersion: row.decision_engine_version,
    metadata,
    createdAt: new Date(row.created_at), expiresAt: new Date(row.expires_at),
    reasons: reasons.rows as ReportReason[],
    evidence: evidence.rows.map((item) => ({ referenceId: item.reference_id, snapshotData: item.snapshot_data })),
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
  const html = await withSpan('report.build', { attributes: { 'report.analysis_id': data.resultId, 'report.locale': locale } },
    () => renderHtml(data, locale));
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
  await getOrCreateReport(token, locale);
  const data = await loadReport(token);
  const pdf = await withSpan('pdf.generate', { attributes: { 'report.analysis_id': data.resultId } },
    () => createPdf(data, locale));
  const pdfUrl = `data:application/pdf;base64,${pdf.toString('base64')}`;
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE report_snapshots SET pdf_url = $1
       WHERE analysis_result_id = $2 AND locale = $3 AND pdf_url IS NULL`,
      [pdfUrl, data.resultId, locale],
    );
  });
  return pdfUrl;
}

function pdfText(value: string): string {
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ').replace(/[\\()]/g, '\\$&');
}

function createPdf(data: ReportData, locale: Locale): Buffer {
  const lines = [
    locale === 'id' ? 'Laporan Operasional Cuaca WeatherOps' : 'WeatherOps Operational Weather Report',
    `${data.location.fullName} | ${data.activity.nameEn}`,
    `Decision: ${data.status} | Risk: ${data.riskLabel} (${data.riskScore}/100) | Confidence: ${data.confidence}`,
    `Window: ${data.scheduledStart.toISOString()} - ${data.scheduledEnd.toISOString()}`,
    `Weather: ${data.weather.source} | Fetched: ${data.weather.fetchedAt.toISOString()}`,
    `Freshness: ${String(data.metadata.snapshotAgeMinutes ?? 'unavailable')} minutes`,
    `Coverage: ${JSON.stringify(data.metadata.slotCoverage ?? { complete: false, ratio: 0 })}`,
    '',
    'Recommendation reasons:',
    ...data.reasons.map((reason) => `- ${reason.severity}: ${reason.code}`),
    '',
    'Forecast evidence:',
    ...data.weather.slots.slice(0, 30).map((slot) =>
      `${String(slot.localDatetime ?? 'unknown')} | ${String(slot.weatherDescNormalized ?? 'UNKNOWN')} | ${String(slot.temperatureC ?? '-')}C | wind ${String(slot.windSpeedMs ?? '-')}m/s`),
    ...(data.alternativeWindows.length ? ['', 'Alternative windows:', ...data.alternativeWindows.map((item) =>
      `- ${item.window.start} - ${item.window.end} | ${item.riskLabel} (${item.riskScore}/100)`)] : []),
    '',
    `Scoring ${data.scoringVersion} | Engine ${data.decisionEngineVersion}`,
    'This report supports operational decision-making and does not replace on-site safety judgment.',
  ];
  const pageLines = 46;
  const pages = Array.from({ length: Math.max(1, Math.ceil(lines.length / pageLines)) }, (_, index) =>
    lines.slice(index * pageLines, (index + 1) * pageLines));
  const objects: string[] = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push(`<< /Type /Pages /Kids [${pages.map((_, index) => `${4 + index * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`);
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  for (const page of pages) {
    const content = [
      'BT',
      '/F1 10 Tf',
      '50 760 Td',
      ...page.map((line, index) => `${index ? '0 -15 Td ' : ''}(${pdfText(line.slice(0, 150))}) Tj`),
      'ET',
    ].join('\n');
    const pageObject = objects.length + 1;
    const contentObject = pageObject + 1;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObject} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream`);
  }
  let output = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets[index + 1] = Buffer.byteLength(output, 'binary');
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(output, 'binary');
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  output += offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(output, 'binary');
}