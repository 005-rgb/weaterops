import { describe, expect, it } from 'vitest';
import { hashSessionKey } from '../src/app/middleware/session-key.js';

describe('session key protection', () => {
  it('produces a deterministic one-way hash for the same client key', () => {
    const key = '11111111-1111-4111-8111-111111111111';
    const first = hashSessionKey(key, 'test-session-salt-1234');
    expect(first).toBe(hashSessionKey(key, 'test-session-salt-1234'));
    expect(first).toHaveLength(64);
    expect(first).not.toContain(key);
  });

  it('changes the digest when the client key changes', () => {
    expect(hashSessionKey('11111111-1111-4111-8111-111111111111', 'test-session-salt-1234'))
      .not.toBe(hashSessionKey('22222222-2222-4222-8222-222222222222', 'test-session-salt-1234'));
  });
});