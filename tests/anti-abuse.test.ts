import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import {
  cleanupChallengeStore,
  hashIp,
  issueChallenge,
  resetAntiAbuseState,
  verifyChallenge,
} from '../src/app/middleware/anti-abuse.js';

describe('anti-abuse primitives', () => {
  it('accepts valid proof of work only once', () => {
    resetAntiAbuseState();
    const challenge = issueChallenge();
    let nonce = 0;
    while (!createHash('sha256').update(`${challenge.seed}${nonce}`).digest('hex').startsWith('0'.repeat(challenge.difficulty))) nonce += 1;
    expect(verifyChallenge(challenge.challengeId, String(nonce))).toBe(true);
    expect(verifyChallenge(challenge.challengeId, String(nonce))).toBe(false);
  });

  it('stores only a salted one-way IP hash', () => {
    const rawIp = '203.0.113.42';
    const digest = hashIp(rawIp, 'a-test-salt-with-16');
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digest).not.toContain(rawIp);
  });

  it('removes expired challenges from the in-memory store', () => {
    resetAntiAbuseState();
    const challenge = issueChallenge();
    cleanupChallengeStore(Date.now() + 121_000);
    expect(verifyChallenge(challenge.challengeId, '0')).toBe(false);
  });
});