import type { RequestHandler } from 'express';
import type { Locale } from '../../modules/i18n/i18n.service.js';

declare module 'express-serve-static-core' {
  interface Request {
    locale: Locale;
  }
}

function supportedLocale(value: unknown): Locale | undefined {
  return value === 'id' || value === 'en' ? value : undefined;
}

export function resolveLocale(header: string | undefined, queryLanguage?: string): Locale {
  const queryLocale = supportedLocale(queryLanguage?.toLowerCase());
  if (queryLocale) return queryLocale;
  for (const item of (header ?? '').toLowerCase().split(',')) {
    const language = item.trim().split(';')[0].split('-')[0];
    const locale = supportedLocale(language);
    if (locale) return locale;
  }
  return 'id';
}

export const localeMiddleware: RequestHandler = (request, _response, next) => {
  request.locale = resolveLocale(
    request.get('Accept-Language'),
    typeof request.query.lang === 'string' ? request.query.lang : undefined,
  );
  next();
};