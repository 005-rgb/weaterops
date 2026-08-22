import { pool } from '../../infrastructure/database/client.js';
import { CATALOG_ENTRIES } from './catalog.js';

export type Locale = 'id' | 'en';
type TranslationMap = Map<string, string>;

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { expiresAt: number; entries: Record<Locale, TranslationMap> } | undefined;
let refreshPromise: Promise<Record<Locale, TranslationMap>> | undefined;

async function loadCatalog(): Promise<Record<Locale, TranslationMap>> {
  const result = await pool.query<{ code: string; locale: Locale; template: string }>(
    'SELECT code, locale, template FROM translation_catalog',
  );
  const entries: Record<Locale, TranslationMap> = { id: new Map(), en: new Map() };
  for (const row of result.rows) entries[row.locale].set(row.code, row.template);
  return entries;
}

async function getCatalog(): Promise<Record<Locale, TranslationMap>> {
  if (cache && cache.expiresAt > Date.now()) return cache.entries;
  refreshPromise ??= loadCatalog().then((entries) => {
    cache = { entries, expiresAt: Date.now() + CACHE_TTL_MS };
    refreshPromise = undefined;
    return entries;
  }).catch((error) => {
    refreshPromise = undefined;
    throw error;
  });
  return refreshPromise;
}

export function interpolateTemplate(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (placeholder, name) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : placeholder);
}

export async function resolveText(
  code: string,
  locale: Locale,
  params: Record<string, string | number> = {},
): Promise<string> {
  let entries: Record<Locale, TranslationMap>;
  try {
    entries = await getCatalog();
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', event: 'translation_catalog_unavailable', code, error }));
    return `[[MISSING:${code}]]`;
  }
  const template = entries[locale].get(code) ?? entries.id.get(code);
  if (!template) {
    console.error(JSON.stringify({ level: 'error', event: 'translation_missing', code, locale }));
    return `[[MISSING:${code}]]`;
  }
  return interpolateTemplate(template, params);
}

export function clearTranslationCache(): void {
  cache = undefined;
}

export function catalogFallbackForTests(code: string, locale: Locale): string | undefined {
  return CATALOG_ENTRIES[code]?.[locale];
}