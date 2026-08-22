import { describe, expect, it } from 'vitest';
import { assertReasonCatalogComplete, CATALOG_ENTRIES } from '../src/modules/i18n/catalog.js';
import { interpolateTemplate } from '../src/modules/i18n/i18n.service.js';
import { resolveLocale } from '../src/app/middleware/locale.js';
import { REASON_CODES } from '../src/modules/decision-engine/reason-codes.js';

describe('translation catalog', () => {
  it('contains an id and en entry for every decision reason code', () => {
    expect(() => assertReasonCatalogComplete()).not.toThrow();
    for (const code of Object.values(REASON_CODES)) {
      expect(CATALOG_ENTRIES[code].id).toBeTruthy();
      expect(CATALOG_ENTRIES[code].en).toBeTruthy();
    }
  });

  it('interpolates structured parameters without exposing missing values', () => {
    expect(interpolateTemplate('Slot {slot_time}, score {score}', { slot_time: '10:00', score: 70 }))
      .toBe('Slot 10:00, score 70');
    expect(interpolateTemplate('Slot {slot_time}', {})).toBe('Slot {slot_time}');
  });
});

describe('locale middleware', () => {
  it.each([
    [{ 'accept-language': 'en-US,en;q=0.8' }, undefined, 'en'],
    [{ 'accept-language': 'fr-FR' }, undefined, 'id'],
    [{ 'accept-language': 'en' }, 'id', 'id'],
    [{}, 'en', 'en'],
  ])('resolves supported locale from header/query', (headers, lang, expected) => {
    expect(resolveLocale('accept-language' in headers ? headers['accept-language'] : undefined, lang)).toBe(expected);
  });
});