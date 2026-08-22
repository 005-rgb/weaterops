import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Map, { Layer, Marker, NavigationControl, Popup, Source, type MapLayerMouseEvent, type ViewStateChangeEvent } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import './styles.css';
import './phase10.css';

type Location = { code: string; name: string; fullName: string; level: string };
type Analysis = { id: string; analysisId?: string; locationCode: string; locationName: string; activityName?: string; riskLabel: 'LOW'|'MODERATE'|'HIGH'|'VERY_HIGH'; decisionStatus: string; timeWindow?: string; scheduledStart?: string; scheduledEnd?: string; confidence: string; riskScore?: number; latitude: number; longitude: number; reportToken?: string; publicToken?: string };
type Language = 'id' | 'en';
type Activity = { code: string; name: string; nameId: string; nameEn: string };
type Report = { resultId: string; token: string; status: string; riskScore: number; riskLabel: string; confidence: string; createdAt: string; expiresAt: string; reasons: { code: string; severity: string; params: Record<string, string | number> }[] };
const ui = {
  en: { platform:'Platform', how:'How it works', trust:'Trust & safety', workspace:'Workspace', signIn:'Sign in', open:'Open workspace', pill:'Weather intelligence for the real world', hero1:'Make every move', hero2:'weather-aware.', heroLead:'WeatherOps turns live weather, location context, and transparent decision logic into one clear operational call.', run:'Run an analysis', explore:'Explore the platform', built:'Built for teams in motion', builtSub:'From field ops to critical planning', for:'ONE SYSTEM FOR', field:'FIELD OPERATIONS', logistics:'LOGISTICS', events:'EVENTS', infrastructure:'INFRASTRUCTURE', agriculture:'AGRICULTURE', way:'01 / THE WEATHEROPS WAY', clarity:'Clarity when', change:'conditions change.', intro:'Most weather data tells you what is happening. WeatherOps helps your team decide what to do next—with evidence you can understand and act on.', see:'See how it works', truth:'One operational truth', truthDesc:'Bring forecasts, hazard context, and local geography into a single decision surface.', receipts:'Decisions with receipts', receiptsDesc:'Every recommendation is traceable to evidence, confidence, and a clear time window.', fieldReady:'Ready for the field', fieldDesc:'Simple outputs for teams that need a confident go, mitigate, defer, or stop.', analysis:'Explore analysis', methodology:'Our methodology', signal:'02 / FROM SIGNAL TO ACTION', calmer:'A calmer way to', move:'move forward.', calmerDesc:'Make operational weather part of your workflow, not another tab your team has to interpret.', set:'Set the context', setDesc:'Choose your exact location, activity, and time window.', read:'Read the conditions', readDesc:'See live hazard signals and local forecast evidence.', call:'Make the call', callDesc:'Share a clear decision with your team.', brief:'DECISION BRIEF', current:'CURRENT', proceed:'PROCEED WITH MITIGATION', conditions:'Conditions are workable. Monitor rainfall intensity before mobilizing.', confidence:'Confidence', sources:'3 evidence sources', op:'03 / YOUR OPERATIONAL WORKSPACE', start:'Start with a', plan:'place and a plan.', startDesc:'Select a location to explore the operational map. WeatherOps keeps the map as input and visualization—the backend remains the authority for every score.', location:'Location selected:', final:'Better decisions', startHere:'start here.', finalDesc:'Bring weather intelligence into the moments that matter.', enter:'Enter the workspace', tagline:'Operational clarity, wherever the weather takes you.' },
  id: { platform:'Platform', how:'Cara kerja', trust:'Kepercayaan & keamanan', workspace:'Workspace', signIn:'Masuk', open:'Buka workspace', pill:'Kecerdasan cuaca untuk dunia nyata', hero1:'Setiap langkah', hero2:'lebih sadar cuaca.', heroLead:'WeatherOps mengubah cuaca terkini, konteks lokasi, dan logika keputusan yang transparan menjadi satu arahan operasional yang jelas.', run:'Jalankan analisis', explore:'Jelajahi platform', built:'Dibuat untuk tim yang bergerak', builtSub:'Dari operasi lapangan hingga perencanaan kritis', for:'SATU SISTEM UNTUK', field:'OPERASI LAPANGAN', logistics:'LOGISTIK', events:'ACARA', infrastructure:'INFRASTRUKTUR', agriculture:'PERTANIAN', way:'01 / CARA WEATHEROPS', clarity:'Kejelasan saat', change:'kondisi berubah.', intro:'Sebagian besar data cuaca memberi tahu apa yang sedang terjadi. WeatherOps membantu tim menentukan langkah berikutnya—dengan bukti yang mudah dipahami dan ditindaklanjuti.', see:'Lihat cara kerjanya', truth:'Satu kebenaran operasional', truthDesc:'Satukan prakiraan, konteks bahaya, dan geografi lokal dalam satu permukaan keputusan.', receipts:'Keputusan dengan bukti', receiptsDesc:'Setiap rekomendasi dapat ditelusuri melalui bukti, tingkat keyakinan, dan jendela waktu yang jelas.', fieldReady:'Siap untuk lapangan', fieldDesc:'Keluaran sederhana untuk tim yang perlu memutuskan lanjut, mitigasi, tunda, atau berhenti.', analysis:'Jelajahi analisis', methodology:'Metodologi kami', signal:'02 / DARI SINYAL KE AKSI', calmer:'Cara yang lebih tenang untuk', move:'melangkah maju.', calmerDesc:'Jadikan cuaca operasional bagian dari alur kerja, bukan tab lain yang harus ditafsirkan tim.', set:'Tetapkan konteks', setDesc:'Pilih lokasi, aktivitas, dan jendela waktu yang tepat.', read:'Baca kondisi', readDesc:'Lihat sinyal bahaya dan bukti prakiraan lokal secara langsung.', call:'Tentukan langkah', callDesc:'Bagikan keputusan yang jelas kepada tim.', brief:'RINGKASAN KEPUTUSAN', current:'TERKINI', proceed:'LANJUT DENGAN MITIGASI', conditions:'Kondisi memungkinkan. Pantau intensitas hujan sebelum mobilisasi.', confidence:'Keyakinan', sources:'3 sumber bukti', op:'03 / WORKSPACE OPERASIONAL', start:'Mulai dari', plan:'lokasi dan rencana.', startDesc:'Pilih lokasi untuk menjelajahi peta operasional. WeatherOps menjadikan peta sebagai input dan visualisasi—backend tetap menjadi otoritas setiap skor.', location:'Lokasi dipilih:', final:'Keputusan lebih baik', startHere:'dimulai di sini.', finalDesc:'Hadirkan kecerdasan cuaca ke momen yang penting.', enter:'Masuk ke workspace', tagline:'Kejelasan operasional, ke mana pun cuaca membawa Anda.' },
};
const mapStyle = 'https://tiles.openfreemap.org/styles/liberty'; // Free development tiles only; production provider requires human confirmation.
const label: Record<string, string> = { LOW: 'Rendah', MODERATE: 'Sedang', HIGH: 'Tinggi', VERY_HIGH: 'Sangat Tinggi' };
const shape: Record<string, string> = { LOW: '●', MODERATE: '▲', HIGH: '■', VERY_HIGH: '◆!' };

const sessionKey = () => {
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  const shared = fragment.get('sk');
  if (shared && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(shared)) {
    localStorage.setItem('weatherops-session-key', shared);
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  }
  let key = localStorage.getItem('weatherops-session-key');
  if (!key) { key = crypto.randomUUID(); localStorage.setItem('weatherops-session-key', key); }
  return key;
};
async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('X-Session-Key', sessionKey());
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: { code?: string; message?: string } };
    const error = new Error(body.error?.message ?? 'Permintaan gagal') as Error & { code?: string };
    error.code = body.error?.code;
    throw error;
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

// PoW runs in a dedicated worker so challenge computation never blocks the UI.
export async function solveProofOfWork(challenge: { challengeId: string; difficulty: number; seed: string }): Promise<string> {
  const workerSource = `
    self.onmessage = async ({ data }) => {
      for (let nonce = 0; ; nonce += 1) {
        const bytes = new TextEncoder().encode(data.seed + nonce);
        const digest = await crypto.subtle.digest('SHA-256', bytes);
        const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
        if (hex.startsWith('0'.repeat(data.difficulty))) { self.postMessage(String(nonce)); return; }
      }
    };
  `;
  const worker = new Worker(URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' })));
  try {
    return await new Promise<string>((resolve, reject) => {
      worker.onmessage = (event) => resolve(event.data as string);
      worker.onerror = () => reject(new Error('Proof-of-work worker failed'));
      worker.postMessage(challenge);
    });
  } finally { worker.terminate(); }
}

export async function analysisApi<T>(url: string, options: RequestInit = {}): Promise<T> {
  const challenge = await api<{ challengeId: string; difficulty: number; seed: string }>('/api/v1/anti-abuse/challenge');
  const nonce = await solveProofOfWork(challenge);
  const headers = new Headers(options.headers);
  headers.set('X-PoW-Challenge-Id', challenge.challengeId);
  headers.set('X-PoW-Nonce', nonce);
  return api<T>(url, { ...options, headers });
}

function TextLocationPicker({ onSelect, lang = 'id' }: { onSelect: (location: Location) => void; lang?: Language }) {
  const levels = ['adm1', 'adm2', 'adm3', 'adm4'] as const;
  const names = ['Provinsi', 'Kabupaten/Kota', 'Kecamatan', 'Desa/Kelurahan'];
  const [selected, setSelected] = useState<string[]>([]);
  const [items, setItems] = useState<Record<string, Location[]>>({});
  const [loading, setLoading] = useState<string | null>('adm1');
  const [error, setError] = useState(false);
  useEffect(() => {
    const index = selected.length;
    if (index >= levels.length) return;
    const level = levels[index];
    const parent = selected[index - 1];
    const controller = new AbortController();
    setLoading(level);
    setError(false);
    const url = `/api/v1/locations?level=${level}${parent ? `&parentCode=${encodeURIComponent(parent)}` : ''}`;
    void api<Location[]>(url, { signal: controller.signal })
      .then((rows) => setItems((old) => ({ ...old, [level]: rows })))
      .catch((cause: unknown) => { if (cause instanceof DOMException && cause.name === 'AbortError') return; setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(null); });
    return () => controller.abort();
  }, [selected]);
  const choose = (index: number, value: string) => {
    if (!value) {
      setSelected((old) => old.slice(0, index));
      return;
    }
    const level = levels[index];
    const item = items[level]?.find((candidate) => candidate.code === value);
    if (!item) return;
    setSelected((old) => [...old.slice(0, index), value]);
    if (index === levels.length - 1) onSelect(item);
  };
  const localizedNames = lang === 'id' ? names : ['Province', 'Regency/City', 'District', 'Village'];
  return <div className="dropdowns" aria-label={lang === 'id' ? 'Pemilih lokasi administratif' : 'Administrative location picker'}>
    {levels.map((level, index) => <label key={level}>{localizedNames[index]}
      <select value={selected[index] ?? ''} disabled={index > selected.length || loading === level} onChange={(event) => choose(index, event.target.value)}>
        <option value="">{loading === level ? (lang === 'id' ? 'Memuat…' : 'Loading…') : (lang === 'id' ? 'Pilih…' : 'Choose…')}</option>
        {(items[level] ?? []).map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
      </select>
    </label>)}
    {error && <small className="dropdown-error">{lang === 'id' ? 'Data lokasi gagal dimuat. Coba lagi.' : 'Location data failed to load. Try again.'}</small>}
  </div>;
}

function supportsWebgl2() { const canvas = document.createElement('canvas'); return Boolean(canvas.getContext('webgl2')); }

export function LocationPickerMap({ onSelect, lang = 'id' }: { onSelect: (location: Location) => void; lang?: Language }) {
  const [view, setView] = useState({ longitude: 117, latitude: -2, zoom: 4.5 }); const [mapFailed, setMapFailed] = useState(() => !supportsWebgl2()); const [query, setQuery] = useState(''); const [results, setResults] = useState<Location[]>([]); const [selected, setSelected] = useState<Location | null>(null); const [boundary, setBoundary] = useState<unknown>();
  const select = useCallback(async (location: Location) => { setSelected(location); onSelect(location); try { setBoundary(await api(`/api/v1/locations/${encodeURIComponent(location.code)}/boundary`)); } catch { setBoundary(undefined); } }, [onSelect]);
  const click = async (event: MapLayerMouseEvent) => { try { const result = await api<Location>(`/api/v1/locations/resolve?lat=${event.lngLat.lat}&lng=${event.lngLat.lng}`); await select(result); } catch { setBoundary(undefined); } };
  useEffect(() => { if (query.trim().length < 2) { setResults([]); return; } const timer = window.setTimeout(() => void api<Location[]>(`/api/v1/locations/search?q=${encodeURIComponent(query)}&viewportLat=${view.latitude}&viewportLng=${view.longitude}`).then(setResults).catch(() => setResults([])), 250); return () => window.clearTimeout(timer); }, [query, view]);
  const copy = lang === 'id' ? {title:'Pilih lokasi operasional', search:'Cari desa, kecamatan…', aria:'Cari lokasi', unavailable:'Peta tidak tersedia. Gunakan pemilihan teks yang setara.', map:'Peta', or:'atau', dropdown:'Dropdown teks', precision:'Presisi', village:'Desa/Kelurahan', district:'Kecamatan'} : {title:'Choose an operational location', search:'Search village, district…', aria:'Search location', unavailable:'Map unavailable. Use the equivalent text picker.', map:'Map', or:'or', dropdown:'Text picker', precision:'Precision', village:'Village', district:'District'};
  return <section className="picker"><div className="map-toolbar"><strong>{copy.title}</strong><div className="search"><input aria-label={copy.aria} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={copy.search} />{results.length > 0 && <ul>{results.map((result) => <li key={result.code}><button onClick={() => { setView({ longitude: 117, latitude: -2, zoom: 7 }); void select(result); setResults([]); }}>{result.name}<small>{result.fullName}</small></button></li>)}</ul>}</div></div>{mapFailed ? <div className="map-fallback"><p>{copy.unavailable}</p><TextLocationPicker onSelect={select} lang={lang} /></div> : <Map {...view} onMove={(e: ViewStateChangeEvent) => setView(e.viewState)} onClick={click} onError={() => setMapFailed(true)} mapStyle={mapStyle} style={{ height: 390 }}><NavigationControl position="bottom-right" />{boundary && <Source id="selected-boundary" type="geojson" data={boundary as any}><Layer id="selected-boundary-fill" type="fill" paint={{ 'fill-color': '#22c55e', 'fill-opacity': 0.22 }} /><Layer id="selected-boundary-line" type="line" paint={{ 'line-color': '#16a34a', 'line-width': 3 }} /></Source>}</Map>}<div className="picker-footer"><button className="tab active" onClick={() => setMapFailed(false)}>{copy.map}</button><span aria-hidden="true">{copy.or}</span><details open><summary className="tab">{copy.dropdown}</summary><TextLocationPicker onSelect={select} lang={lang} /></details>{selected && <span className="precision">{copy.precision}: {selected.level === 'adm4' ? copy.village : copy.district} ({selected.level})</span>}</div></section>;
}

export function TrackingMap({ analyses }: { analyses: Analysis[] }) {
  const [selected, setSelected] = useState<Analysis | null>(null); const [heatmap, setHeatmap] = useState(false); const [mapFailed, setMapFailed] = useState(() => !supportsWebgl2());
  const geojson = useMemo(() => ({ type: 'FeatureCollection', features: analyses.map((a) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [a.longitude, a.latitude] }, properties: { hazardScore: a.riskLabel === 'VERY_HIGH' ? 90 : a.riskLabel === 'HIGH' ? 70 : 40 } })) }), [analyses]);
  return <section className="tracking"><div className="tracking-map">{mapFailed ? <p className="map-fallback">Peta gagal dimuat. Data tetap tersedia pada daftar di samping.</p> : <Map initialViewState={{ longitude: 117, latitude: -2, zoom: 4.5 }} mapStyle={mapStyle} onError={() => setMapFailed(true)}><NavigationControl />{heatmap && <Source id="hazard" type="geojson" data={geojson as any}><Layer id="hazard-layer" type="heatmap" paint={{ 'heatmap-weight': ['get', 'hazardScore'], 'heatmap-radius': 30, 'heatmap-opacity': .65 }} /></Source>}{analyses.map((analysis) => <Marker key={analysis.id} longitude={analysis.longitude} latitude={analysis.latitude} anchor="bottom"><button className={`marker risk-${analysis.riskLabel.toLowerCase()}`} aria-label={`${label[analysis.riskLabel]} — ${analysis.locationName}`} onClick={() => setSelected(analysis)}>{shape[analysis.riskLabel]}</button></Marker>)}{selected && <Popup longitude={selected.longitude} latitude={selected.latitude} onClose={() => setSelected(null)} closeOnClick={false}><strong>{label[selected.riskLabel]} — {selected.locationName}</strong><p>{selected.decisionStatus}<br />{selected.timeWindow}<br />Confidence: {selected.confidence}</p>{selected.reportToken && <a href={`/api/v1/reports/${selected.reportToken}`}>Lihat laporan lengkap</a>}</Popup>}</Map>}</div><aside className="tracking-panel"><label className="toggle"><input type="checkbox" checked={heatmap} onChange={(e) => setHeatmap(e.target.checked)} /> Tampilkan heatmap hazard</label><p className="caption">Heatmap = agregasi HAZARD CUACA, bukan skor risiko proyek.</p><h2>Analisis aktif</h2><ul className="analysis-list" aria-label="Daftar analisis aktif">{analyses.map((a) => <li key={a.id}><button onClick={() => setSelected(a)}><span className={`swatch risk-${a.riskLabel.toLowerCase()}`}>{shape[a.riskLabel]}</span><span><strong>{label[a.riskLabel]} — {a.locationName}</strong><small>{a.decisionStatus} · {a.timeWindow} · Confidence {a.confidence}</small></span></button></li>)}</ul></aside></section>;
}

type BoardSummary = { totalAnalyses: number; byDecisionStatus: Record<string, number>; byRiskLabel: Record<string, number> };
function BoardPage({ lang }: { lang: Language }) {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [summary, setSummary] = useState<BoardSummary>({ totalAnalyses: 0, byDecisionStatus: {}, byRiskLabel: {} });
  const [labelValue, setLabelValue] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const copy = lang === 'id'
    ? { title: 'Session board', lead: 'Semua analisis Anda, tanpa login.', label: 'Nama board', save: 'Simpan board', total: 'Total proyek', high: 'berisiko tinggi minggu ini', table: 'Analisis tersimpan', location: 'Lokasi', activity: 'Aktivitas', schedule: 'Jadwal', decision: 'Keputusan', risk: 'Risiko', confidence: 'Keyakinan', action: 'Aksi', report: 'Lihat laporan', share: 'Bagikan board', warning: 'Siapa pun yang membuka tautan ini mendapat akses PENUH ke board Anda.', cancel: 'Batal', confirm: 'Buat tautan', empty: 'Belum ada analisis tersimpan.' }
    : { title: 'Session board', lead: 'All your analyses, without login.', label: 'Board name', save: 'Save board', total: 'Total projects', high: 'are high risk this week', table: 'Saved analyses', location: 'Location', activity: 'Activity', schedule: 'Schedule', decision: 'Decision', risk: 'Risk', confidence: 'Confidence', action: 'Action', report: 'View report', share: 'Share board', warning: 'Anyone who opens this link gets FULL access to your board.', cancel: 'Cancel', confirm: 'Create link', empty: 'No saved analyses yet.' };
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const board = await api<{ sessionKeyHash: string }>('/api/v1/session-boards', { method: 'POST', body: JSON.stringify({}), headers: { 'Content-Type': 'application/json' } });
      const [rows, totals] = await Promise.all([
        api<Analysis[]>(`/api/v1/session-boards/${board.sessionKeyHash}/analyses${status ? `?status=${encodeURIComponent(status)}` : ''}`),
        api<BoardSummary>(`/api/v1/session-boards/${board.sessionKeyHash}/summary`),
      ]);
      setAnalyses(rows.map((row) => ({ ...row, id: row.analysisId ?? row.id, timeWindow: `${new Date(row.scheduledStart ?? '').toLocaleString()} – ${new Date(row.scheduledEnd ?? '').toLocaleString()}` })));
      setSummary(totals);
    } catch (e) { setError(e instanceof Error ? e.message : 'Gagal memuat board'); }
    finally { setLoading(false); }
  }, [status]);
  useEffect(() => { void load(); }, [load]);
  const saveLabel = async () => { await api('/api/v1/session-boards', { method: 'POST', body: JSON.stringify({ label: labelValue }), headers: { 'Content-Type': 'application/json' } }); };
  const shareUrl = `${window.location.origin}/board#sk=${sessionKey()}`;
  return <main className="board-page">
    <div className="board-header"><div><div className="section-kicker">WEATHEROPS / WORKSPACE</div><h1>{copy.title}</h1><p>{copy.lead}</p></div><button className="secondary-button board-share" onClick={() => setShareOpen(true)}>↗ {copy.share}</button></div>
    <div className="board-controls"><input aria-label={copy.label} value={labelValue} onChange={(e) => setLabelValue(e.target.value)} placeholder={copy.label} /><button className="primary-button" onClick={() => void saveLabel()}>{copy.save}</button><select aria-label="Filter status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All decisions</option><option value="PROCEED">PROCEED</option><option value="DEFER">DEFER</option><option value="NOT_RECOMMENDED">NOT_RECOMMENDED</option><option value="PROCEED_WITH_MITIGATION">PROCEED_WITH_MITIGATION</option></select></div>
    <section className="board-summary"><div><small>{copy.total}</small><strong>{summary.totalAnalyses}</strong></div><div className="summary-sentence"><strong>{(summary.byRiskLabel.HIGH ?? 0) + (summary.byRiskLabel.VERY_HIGH ?? 0)}</strong> {copy.high}</div></section>
    {error && <p className="board-error">{error}</p>}{loading ? <p className="board-empty">Loading…</p> : analyses.length === 0 ? <p className="board-empty">{copy.empty}</p> : <><TrackingMap analyses={analyses} /><section className="board-table-wrap"><h2>{copy.table}</h2><table><thead><tr><th>{copy.location}</th><th>{copy.activity}</th><th>{copy.schedule}</th><th>{copy.decision}</th><th>{copy.risk}</th><th>{copy.confidence}</th><th>{copy.action}</th></tr></thead><tbody>{analyses.map((a) => <tr key={a.id}><td>{a.locationName}</td><td>{a.activityName ?? '—'}</td><td>{a.timeWindow}</td><td><span className={`status-pill status-${a.decisionStatus.toLowerCase()}`}>{a.decisionStatus}</span></td><td className={`risk-${a.riskLabel.toLowerCase()}`}>{a.riskLabel} {a.riskScore !== undefined && `(${a.riskScore})`}</td><td>{a.confidence}</td><td>{a.publicToken && <a href={`/api/v1/reports/${a.publicToken}`} target="_blank" rel="noreferrer">{copy.report} ↗</a>}</td></tr>)}</tbody></table></section></>}
    {shareOpen && <div className="share-modal" role="dialog" aria-modal="true"><div><h2>{copy.share}</h2><p>{copy.warning}</p><input readOnly value={shareUrl} /><div><button className="secondary-button" onClick={() => setShareOpen(false)}>{copy.cancel}</button><button className="primary-button" onClick={() => { void navigator.clipboard?.writeText(shareUrl); setShareOpen(false); }}>{copy.confirm}</button></div></div></div>}
  </main>;
}

const messages: Record<string, { id: string; en: string }> = {
  VALIDATION_FAILED: { id: 'Periksa kembali data yang diisi sebelum melanjutkan.', en: 'Check the fields and try again.' },
  LOCATION_NOT_FOUND: { id: 'Lokasi tidak ditemukan atau bukan desa/kelurahan aktif.', en: 'The location was not found or is not an active village.' },
  ACTIVITY_NOT_FOUND: { id: 'Aktivitas tidak tersedia. Pilih aktivitas lain.', en: 'This activity is unavailable. Choose another activity.' },
  WEATHER_SOURCE_UNAVAILABLE: { id: 'Sumber cuaca sementara tidak tersedia.', en: 'The weather source is temporarily unavailable.' },
  BMKG_SCHEMA_VALIDATION_FAILED: { id: 'Format data cuaca berubah. Coba lagi sebentar.', en: 'The weather data format changed. Please try again.' },
  LOCATION_RESOLUTION_FAILED: { id: 'Titik peta belum berada di wilayah yang dapat dikenali.', en: 'The map point is outside a recognized boundary.' },
  BOUNDARY_UNAVAILABLE: { id: 'Batas wilayah belum tersedia, tetapi lokasi tetap dapat dipilih.', en: 'The boundary is unavailable, but the location can still be selected.' },
  ANTI_ABUSE_CHALLENGE_REQUIRED: { id: 'Selesaikan verifikasi singkat untuk melanjutkan.', en: 'Complete the short verification to continue.' },
  RATE_BLOCKED: { id: 'Terlalu banyak analisis dalam waktu singkat. Coba lagi nanti.', en: 'Too many analyses in a short period. Try again later.' },
  INTERNAL_ERROR: { id: 'Layanan mengalami kendala. Coba lagi.', en: 'The service encountered a problem. Try again.' },
};
const textFor = (lang: Language, code?: string) => messages[code ?? 'INTERNAL_ERROR']?.[lang] ?? messages.INTERNAL_ERROR[lang];
const catalogText: Record<string, { id: string; en: string }> = {
  'status.PROCEED': { id: 'Lanjutkan sesuai jadwal', en: 'Proceed as scheduled' },
  'status.DEFER': { id: 'Tunda pelaksanaan', en: 'Defer the activity' },
  'status.ALTERNATIVE_WINDOW': { id: 'Gunakan waktu alternatif', en: 'Use an alternative window' },
  'status.PROCEED_WITH_MITIGATION': { id: 'Lanjutkan dengan mitigasi', en: 'Proceed with mitigation' },
  'status.NOT_RECOMMENDED': { id: 'Tidak direkomendasikan', en: 'Not recommended' },
  'risk.LOW': { id: 'Rendah', en: 'Low' }, 'risk.MODERATE': { id: 'Sedang', en: 'Moderate' },
  'risk.HIGH': { id: 'Tinggi', en: 'High' }, 'risk.VERY_HIGH': { id: 'Sangat tinggi', en: 'Very high' },
  'confidence.LOW': { id: 'Rendah', en: 'Low' }, 'confidence.MEDIUM': { id: 'Sedang', en: 'Medium' },
  'confidence.HIGH': { id: 'Tinggi', en: 'High' },
};
const localDateTime = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

function ReportPage({ token, lang, onLanguage }: { token: string; lang: Language; onLanguage: (lang: Language) => void }) {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const [pdf, setPdf] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const copy = lang === 'id' ? { title: 'Laporan keputusan operasional', score: 'Skor risiko', level: 'Tingkat risiko', confidence: 'Keyakinan', reasons: 'Dasar rekomendasi', download: 'Unduh PDF', loading: 'Memuat laporan…', disclaimer: 'DRAFT — Laporan ini membantu keputusan operasional berdasarkan prakiraan yang tersedia. Ini bukan jaminan cuaca dan tidak menggantikan penilaian keselamatan di lapangan.', retry: 'Coba lagi' } : { title: 'Operational decision report', score: 'Risk score', level: 'Risk level', confidence: 'Confidence', reasons: 'Recommendation basis', download: 'Download PDF', loading: 'Loading report…', disclaimer: 'DRAFT — This report supports operational decisions based on available forecasts. It is not a weather guarantee and does not replace on-site safety judgment.', retry: 'Try again' };
  const load = useCallback(async () => { setError(''); try { setReport(await api<Report>(`/api/v1/reports/${encodeURIComponent(token)}?format=json&lang=${lang}`)); } catch (e) { const cause = e as Error & { code?: string }; setError(textFor(lang, cause.code)); } }, [token, lang]);
  useEffect(() => { void load(); }, [load]);
  const statusText = (value: string) => catalogText[value]?.[lang] ?? value.replaceAll('_', ' ');
  const riskClass = report?.riskLabel.toLowerCase().replace('_', '-') ?? 'low';
  return <main className="report-page">
    <header className="report-header"><a className="brand" href="/"><span className="brand-mark"><span>W</span></span><span>weather<span className="brand-muted">ops</span></span></a><div className="report-actions"><button className="language-toggle" onClick={() => onLanguage(lang === 'id' ? 'en' : 'id')}>{lang === 'id' ? 'EN' : 'ID'}</button>{report && <button className="primary-button" onClick={async () => { const result = await api<{ pdfUrl: string }>(`/api/v1/reports/${token}/report.pdf`, { method: 'POST' }); setPdf(result.pdfUrl); }}>{copy.download}</button>}</div></header>
    {error ? <section className="report-state"><p>{error}</p><button className="primary-button" onClick={() => void load()}>{copy.retry}</button></section> : !report ? <p className="report-state">{copy.loading}</p> : <section className="report-content"><div className={`decision-card risk-${riskClass}`}><span className="decision-shape" aria-hidden="true">{shape[report.riskLabel] ?? '●'}</span><div><span className="section-kicker">{copy.title}</span><h1>{statusText(report.status)}</h1><p>{copy.level}: <strong>{statusText(`risk.${report.riskLabel}`)}</strong></p></div><strong className="report-score">{report.riskScore}<small>/100</small></strong></div><div className="report-metrics"><div><span>{copy.score}</span><strong>{report.riskScore}/100</strong></div><div><span>{copy.level}</span><strong>{statusText(`risk.${report.riskLabel}`)}</strong></div><div><span>{copy.confidence}</span><strong>{statusText(`confidence.${report.confidence}`)}</strong></div></div><section className="reasons"><h2>{copy.reasons}</h2>{report.reasons.length ? report.reasons.map((reason, index) => <details key={`${reason.code}-${index}`} open={expanded === index} onToggle={(event) => { if ((event.target as HTMLDetailsElement).open) setExpanded(index); }}><summary><span className={`severity severity-${reason.severity}`}>{reason.severity}</span>{textFor(lang, reason.code)}</summary><p>Evidence reference tersedia untuk audit keputusan ini.</p></details>) : <p>{lang === 'id' ? 'Tidak ada alasan tambahan.' : 'No additional reasons.'}</p>}</section><p className="disclaimer">{copy.disclaimer}</p>{pdf && <a className="pdf-ready" download={`weatherops-${token}.pdf`} href={pdf}>PDF siap diunduh</a>}</section>}
  </main>;
}

function Wizard({ lang, onLanguage }: { lang: Language; onLanguage: (lang: Language) => void }) {
  const [step, setStep] = useState(0); const [location, setLocation] = useState<Location | null>(null); const [activities, setActivities] = useState<Activity[]>([]); const [activity, setActivity] = useState(''); const [start, setStart] = useState(localDateTime(new Date(Date.now() + 3600000))); const [end, setEnd] = useState(localDateTime(new Date(Date.now() + 7200000))); const [impact, setImpact] = useState(1); const [error, setError] = useState<{ code?: string; message: string } | null>(null); const [busy, setBusy] = useState(false); const [phase, setPhase] = useState('');
  const copy = lang === 'id' ? { title: 'Buat keputusan yang siap dibawa ke lapangan', steps: ['Lokasi', 'Aktivitas', 'Jadwal', 'Dampak', 'Review'], next: 'Lanjut', back: 'Kembali', analyse: 'Analisis cuaca', location: 'Pilih lokasi yang tepat untuk operasi.', activity: 'Apa yang akan dilakukan?', schedule: 'Tentukan jendela kerja.', impact: 'Seberapa besar dampak penundaan?', impactHelp: 'Pengali dampak hanya memengaruhi skor operasional.', review: 'Periksa input Anda sebelum analisis.', selected: 'Lokasi terpilih', loading: ['Menyiapkan verifikasi…', 'Mengambil prakiraan cuaca terkini…', 'Menyusun keputusan berbasis bukti…'], retry: 'Coba lagi' } : { title: 'Create a decision ready for the field', steps: ['Location', 'Activity', 'Schedule', 'Impact', 'Review'], next: 'Continue', back: 'Back', analyse: 'Analyse weather', location: 'Choose the precise location for the operation.', activity: 'What will be happening?', schedule: 'Set the work window.', impact: 'How costly is a delay?', impactHelp: 'The impact multiplier only affects the operational score.', review: 'Review your inputs before analysis.', selected: 'Selected location', loading: ['Preparing verification…', 'Fetching current forecast…', 'Building an evidence-based decision…'], retry: 'Try again' };
  useEffect(() => { void api<Activity[]>('/api/v1/activities').then(setActivities).catch(() => setActivities([{ code: 'CONCRETE_POUR', name: 'Concrete Pour', nameId: 'Pengecoran', nameEn: 'Concrete Pour' }, { code: 'EARTHWORK', name: 'Earthwork', nameId: 'Pekerjaan tanah', nameEn: 'Earthwork' }, { code: 'ROOFING', name: 'Roofing', nameId: 'Pekerjaan atap', nameEn: 'Roofing' }])); }, []);
  const canNext = [Boolean(location), Boolean(activity), Date.parse(end) > Date.parse(start) && Date.parse(start) > Date.now(), impact >= 0.5 && impact <= 3, true][step];
  const submit = async () => { setBusy(true); setError(null); try { setPhase(copy.loading[0]); await new Promise((resolve) => setTimeout(resolve, 150)); setPhase(copy.loading[1]); const result = await analysisApi<{ reportToken: string }>('/api/v1/analyses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locationCode: location?.code, activityCode: activity, scheduledStart: new Date(start).toISOString(), scheduledEnd: new Date(end).toISOString(), operationalImpact: { impactMultiplier: impact } }) }); setPhase(copy.loading[2]); window.location.href = `/report/${result.reportToken}`; } catch (e) { const cause = e as Error & { code?: string }; setError({ code: cause.code, message: textFor(lang, cause.code) }); setBusy(false); } };
  return <section className="wizard" id="wizard"><div className="wizard-head"><div><div className="section-kicker">WEATHEROPS / ANALYSIS</div><h2>{copy.title}</h2></div><button className="language-toggle" onClick={() => onLanguage(lang === 'id' ? 'en' : 'id')}>{lang === 'id' ? 'EN' : 'ID'}</button></div><div className="wizard-progress" aria-label="Wizard progress">{copy.steps.map((item, index) => <button key={item} className={index === step ? 'active' : index < step ? 'done' : ''} onClick={() => index < step && setStep(index)}><b>{index + 1}</b>{item}</button>)}</div><div className="wizard-body">{step === 0 && <><p className="wizard-lead">{copy.location}</p><LocationPickerMap onSelect={setLocation} lang={lang} />{location && <p className="selected">{copy.selected}: <strong>{location.fullName}</strong></p>}</>}{step === 1 && <><p className="wizard-lead">{copy.activity}</p><div className="activity-grid">{activities.map((item) => <button key={item.code} className={activity === item.code ? 'activity-card active' : 'activity-card'} onClick={() => setActivity(item.code)}><span aria-hidden="true">✦</span><strong>{lang === 'id' ? item.nameId : item.nameEn}</strong><small>{item.code.replaceAll('_', ' ')}</small></button>)}</div></>}{step === 2 && <><p className="wizard-lead">{copy.schedule}</p><div className="field-grid"><label htmlFor="scheduled-start">Mulai / Start<input id="scheduled-start" type="datetime-local" value={start} min={localDateTime(new Date())} onChange={(e) => setStart(e.target.value)} /></label><label htmlFor="scheduled-end">Selesai / End<input id="scheduled-end" type="datetime-local" value={end} min={start} onChange={(e) => setEnd(e.target.value)} /></label></div>{Date.parse(end) <= Date.parse(start) && <p className="field-error">End harus setelah start.</p>}</>}{step === 3 && <><p className="wizard-lead">{copy.impact}</p><label className="range-field" htmlFor="impact"><strong>{impact.toFixed(1)}×</strong><input id="impact" type="range" min="0.5" max="3" step="0.1" value={impact} onChange={(e) => setImpact(Number(e.target.value))} /><span>0.5× &nbsp; — &nbsp; 3×</span></label><p className="helper">{copy.impactHelp}</p></>}{step === 4 && <><p className="wizard-lead">{copy.review}</p><div className="review-card"><p><span>{copy.steps[0]}</span><strong>{location?.fullName}</strong></p><p><span>{copy.steps[1]}</span><strong>{activities.find((item) => item.code === activity)?.[lang === 'id' ? 'nameId' : 'nameEn']}</strong></p><p><span>{copy.steps[2]}</span><strong>{new Date(start).toLocaleString()} — {new Date(end).toLocaleString()}</strong></p><p><span>{copy.steps[3]}</span><strong>{impact.toFixed(1)}×</strong></p></div></>}{error && <div className="inline-error" role="alert"><strong>{error.code ?? 'ERROR'}</strong><span>{error.message}</span>{error.code === 'WEATHER_SOURCE_UNAVAILABLE' && <button onClick={() => void submit()}>{copy.retry}</button>}{error.code === 'ANTI_ABUSE_CHALLENGE_REQUIRED' && <span> CAPTCHA diperlukan oleh server.</span>}</div>}{busy && <div className="loading-state" role="status"><span className="loading-dot" />{phase}</div>}<div className="wizard-actions">{step > 0 && <button className="secondary-button" onClick={() => setStep(step - 1)}>{copy.back}</button>}{step < 4 ? <button className="primary-button" disabled={!canNext} onClick={() => setStep(step + 1)}>{copy.next} →</button> : <button className="primary-button" disabled={busy} onClick={() => void submit()}>{copy.analyse} ↗</button>}</div></div></section>;
}

const demo: Analysis[] = [
  { id: 'a1', locationCode: 'DUMMY-KEL-1', locationName: 'Kelurahan Barat', riskLabel: 'LOW', decisionStatus: 'PROCEED', timeWindow: '08:00–10:00', confidence: 'HIGH', latitude: 0, longitude: -0.01 },
  { id: 'a2', locationCode: 'DUMMY-KEL-2', locationName: 'Kelurahan Timur', riskLabel: 'MODERATE', decisionStatus: 'PROCEED_WITH_MITIGATION', timeWindow: '10:00–12:00', confidence: 'MEDIUM', latitude: 0, longitude: 0.01 },
  { id: 'a3', locationCode: 'DUMMY-KEC', locationName: 'Kecamatan Dummy', riskLabel: 'HIGH', decisionStatus: 'DEFER', timeWindow: '13:00–15:00', confidence: 'MEDIUM', latitude: 0.01, longitude: 0 },
  { id: 'a4', locationCode: 'DUMMY-KAB', locationName: 'Kabupaten Dummy', riskLabel: 'VERY_HIGH', decisionStatus: 'NOT_RECOMMENDED', timeWindow: '16:00–18:00', confidence: 'LOW', latitude: -0.01, longitude: 0 },
];
function App() {
  const [picked, setPicked] = useState<Location | null>(null);
  const [dark, setDark] = useState(() => localStorage.getItem('weatherops-theme') !== 'light');
  const [lang, setLang] = useState<Language>(() => (localStorage.getItem('weatherops-language') as Language) || 'id');
  const [menuOpen, setMenuOpen] = useState(false);
  const t = ui[lang];
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem('weatherops-theme', dark ? 'dark' : 'light');
  }, [dark]);
  useEffect(() => { document.documentElement.lang = lang; localStorage.setItem('weatherops-language', lang); }, [lang]);
  if (window.location.pathname === '/board') return <div className="site-shell"><BoardPage lang={lang} /></div>;
  if (window.location.pathname.startsWith('/report/')) return <div className="site-shell"><ReportPage token={decodeURIComponent(window.location.pathname.split('/')[2] ?? '')} lang={lang} onLanguage={setLang} /></div>;
  return <div className="site-shell">
    <nav className="nav">
      <a className="brand" href="#" aria-label="WeatherOps home"><span className="brand-mark"><span>W</span></span><span>weather<span className="brand-muted">ops</span></span></a>
      <div className={`nav-links ${menuOpen ? 'open' : ''}`}><a href="#platform" onClick={() => setMenuOpen(false)}>{t.platform}</a><a href="#how-it-works" onClick={() => setMenuOpen(false)}>{t.how}</a><a href="#trust" onClick={() => setMenuOpen(false)}>{t.trust}</a><a href="#workspace" onClick={() => setMenuOpen(false)}>{t.workspace}</a></div>
      <div className="nav-actions"><button className="language-toggle" aria-label="Change language" onClick={() => setLang((value) => value === 'id' ? 'en' : 'id')}>{lang === 'id' ? 'EN' : 'ID'}</button><button className="theme-toggle" aria-label="Toggle color theme" onClick={() => setDark((value) => !value)}><span className="sun">☼</span><span className="moon">◐</span></button><a className="text-button" href="#workspace">{t.signIn}</a><a className="nav-cta" href="#workspace">{t.open} <span>↗</span></a><button className="menu-button" aria-label="Toggle menu" onClick={() => setMenuOpen((value) => !value)}>☰</button></div>
    </nav>
    <main>
      <section className="hero">
        <div className="hero-copy"><div className="pill"><span className="status-dot" /> {t.pill}</div><h1>{t.hero1}<br /><em>{t.hero2}</em></h1><p className="hero-lede">{t.heroLead}</p><div className="hero-actions"><a className="primary-button" href="#workspace">{t.run} <span>↗</span></a><a className="secondary-button" href="#platform"><span className="play-icon">▶</span> {t.explore}</a></div><div className="hero-proof"><div className="avatars"><span>AN</span><span>RS</span><span>DK</span><span>+</span></div><p><strong>{t.built}</strong><br /><span>{t.builtSub}</span></p></div></div>
        <div className="hero-visual" aria-label="WeatherOps operational overview"><div className="visual-glow" /><div className="orbital orbital-one" /><div className="orbital orbital-two" /><div className="orbital orbital-three" /><div className="visual-header"><span className="mini-brand"><span className="brand-mark small"><span>W</span></span> weatherops</span><span className="live-label"><i /> {lang === 'id' ? 'Kondisi terkini' : 'Live conditions'}</span></div><div className="radar"><div className="radar-sweep" /><div className="radar-ring ring-a" /><div className="radar-ring ring-b" /><div className="radar-ring ring-c" /><span className="radar-point p1" /><span className="radar-point p2" /><span className="radar-point p3" /><span className="radar-point p4" /><div className="radar-center"><strong>92</strong><span>{lang === 'id' ? 'skor kesiapan' : 'readiness score'}</span></div></div><div className="visual-footer"><span>▣ &nbsp; Jakarta, ID</span><span>{lang === 'id' ? 'Diperbarui baru saja' : 'Updated just now'} &nbsp; ↗</span></div></div>
      </section>
      <section className="trust-strip" id="trust"><span>{t.for}</span><div><strong>{t.field}</strong><strong>{t.logistics}</strong><strong>{t.events}</strong><strong>{t.infrastructure}</strong><strong>{t.agriculture}</strong></div></section>
      <section className="section intro" id="platform"><div className="section-kicker">{t.way}</div><div className="intro-grid"><h2>{t.clarity}<br /><span>{t.change}</span></h2><div><p className="section-lede">{t.intro}</p><a className="inline-link" href="#how-it-works">{t.see} <span>→</span></a></div></div><div className="feature-grid"><article className="feature-card featured"><span className="feature-number">01</span><div className="feature-icon blue">✦</div><h3>{t.truth}</h3><p>{t.truthDesc}</p><a href="#workspace">{t.analysis} <span>↗</span></a><div className="card-lines" /></article><article className="feature-card"><span className="feature-number">02</span><div className="feature-icon purple">⌁</div><h3>{t.receipts}</h3><p>{t.receiptsDesc}</p><a href="#trust">{t.methodology} <span>↗</span></a></article><article className="feature-card"><span className="feature-number">03</span><div className="feature-icon green">◌</div><h3>{t.fieldReady}</h3><p>{t.fieldDesc}</p><a href="#workspace">{t.open} <span>↗</span></a></article></div></section>
      <section className="section workflow" id="how-it-works"><div className="workflow-copy"><div className="section-kicker">{t.signal}</div><h2>{t.calmer}<br /><span>{t.move}</span></h2><p className="section-lede">{t.calmerDesc}</p><div className="steps"><div className="step active"><b>01</b><span><strong>{t.set}</strong><small>{t.setDesc}</small></span></div><div className="step"><b>02</b><span><strong>{t.read}</strong><small>{t.readDesc}</small></span></div><div className="step"><b>03</b><span><strong>{t.call}</strong><small>{t.callDesc}</small></span></div></div></div><div className="decision-preview"><div className="preview-top"><span>{t.brief}</span><span className="preview-live"><i /> {t.current}</span></div><div className="preview-location"><span className="location-pin">⌖</span><div><strong>Jakarta Selatan</strong><small>{lang === 'id' ? 'Hari ini' : 'Today'} · 14:00—16:00</small></div></div><div className="decision-score"><div className="score-ring"><strong>72</strong><small>/ 100</small></div><div><span className="decision-tag">{t.proceed}</span><p>{t.conditions}</p></div></div><div className="preview-bars"><span><i style={{width:'78%'}} /> {lang === 'id' ? 'Hujan' : 'Rainfall'}</span><span><i style={{width:'42%'}} /> {lang === 'id' ? 'Angin' : 'Wind'}</span><span><i style={{width:'25%'}} /> {lang === 'id' ? 'Jarak pandang' : 'Visibility'}</span></div><div className="preview-foot"><span>{t.confidence} <strong>HIGH</strong></span><span>{t.sources}</span></div></div></section>
       <section className="workspace-section" id="workspace"><Wizard lang={lang} onLanguage={setLang} /><div className="workspace-board-link"><a className="secondary-button" href="/board">{lang === 'id' ? 'Buka session board →' : 'Open session board →'}</a></div></section>
      <section className="final-cta"><div className="section-kicker">WEATHEROPS / 2026</div><h2>{t.final}<br /><em>{t.startHere}</em></h2><p>{t.finalDesc}</p><a className="primary-button" href="#workspace">{t.enter} <span>↗</span></a></section>
    </main>
     <footer><a className="brand" href="#"><span className="brand-mark"><span>W</span></span><span>weather<span className="brand-muted">ops</span></span></a><span>{t.tagline}</span><nav className="footer-links"><a href="#methodology">{t.methodology}</a><a href="#about">{lang === 'id' ? 'Tentang data' : 'About data'}</a><a href="#privacy">{lang === 'id' ? 'Privasi' : 'Privacy'}</a></nav><span>© 2026 WeatherOps</span></footer>
  </div>
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);