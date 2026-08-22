import { describe, expect, it } from 'vitest';

import { loadEnv } from '../src/app/config/env.js';

describe('environment validator', () => {
  it('rejects an empty DATABASE_URL', () => {
    expect(() => loadEnv({ DATABASE_URL: '' })).toThrow(/DATABASE_URL/);
  });
});