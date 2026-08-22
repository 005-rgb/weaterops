import { createHash, randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { ApiError } from '../../shared/errors/error-codes.js';
import { antiAbuseEventsRepository, countRecentAnalyses, cleanupExpiredAntiAbuseEvents } from '../../modules/anti-abuse/anti-abuse.repository.js';

type Challenge = { seed: string; difficulty: number; expiresAt: number };
type SessionRisk = { score: number; passed: number; failed: number; captchaUntil: number; sessions: Set<string>; requests: number[] };
const challenges = new Map<string, Challenge>();
const limits = new Map<string, number[]>();
const risks = new Map<string, SessionRisk>();

declare module 'express-serve-static-core' {
  interface Request { antiAbuseRisk?: number; }
}

export function hashIp(ip: string, salt = env.IP_HASH_SALT): string {
  return createHash('sha256').update(`${salt}:${ip}`, 'utf8').digest('hex');
}

function clientIp(request: Parameters<RequestHandler>[0]): string {
  return request.ip || request.socket.remoteAddress || 'unknown';
}
function userAgentClass(value: string): string {
  const ua = value.toLowerCase();
  if (!ua) return 'unknown';
  if (/bot|crawler|spider|headless|curl|wget/.test(ua)) return 'bot-like';
  if (/mobile|android|iphone|ipad/.test(ua)) return 'mobile';
  return 'desktop';
}
function fingerprint(request: Parameters<RequestHandler>[0], ipHash: string): string {
  const viewport = request.header('X-Viewport');
  const safeViewport = viewport && /^\d{2,5}x\d{2,5}$/.test(viewport) ? viewport : 'unknown';
  return `${ipHash}:${userAgentClass(request.header('user-agent') ?? '')}:${safeViewport}`;
}
async function record(eventType: string, ipHash: string, riskScore: number): Promise<void> {
  try { await antiAbuseEventsRepository.create({ event_type: eventType, ip_hash: ipHash, risk_score: Math.min(100, Math.max(0, riskScore)) }); }
  catch { /* Abuse telemetry must not take down the protected endpoint when DB is degraded. */ }
}
function stateFor(key: string, sessionKeyHash: string | null): SessionRisk {
  let state = risks.get(key);
  if (!state) { state = { score: 0, passed: 0, failed: 0, captchaUntil: 0, sessions: new Set(), requests: [] }; risks.set(key, state); }
  if (sessionKeyHash) state.sessions.add(sessionKeyHash);
  const cutoff = Date.now() - 60 * 60 * 1000;
  state.requests = state.requests.filter((time) => time > cutoff);
  return state;
}

export function issueChallenge(): { challengeId: string; difficulty: number; seed: string } {
  const challengeId = randomUUID();
  const seed = randomUUID().replaceAll('-', '');
  challenges.set(challengeId, { seed, difficulty: env.POW_DIFFICULTY, expiresAt: Date.now() + env.POW_TTL_MS });
  return { challengeId, difficulty: env.POW_DIFFICULTY, seed };
}
export function verifyChallenge(challengeId: string | undefined, nonce: string | undefined): boolean {
  if (!challengeId || !nonce || !/^\d{1,12}$/.test(nonce)) return false;
  const challenge = challenges.get(challengeId);
  challenges.delete(challengeId);
  if (!challenge || challenge.expiresAt < Date.now()) return false;
  return createHash('sha256').update(`${challenge.seed}${nonce}`).digest('hex').startsWith('0'.repeat(challenge.difficulty));
}
export function resetAntiAbuseState(): void { challenges.clear(); limits.clear(); risks.clear(); }
export function cleanupChallengeStore(now = Date.now()): void {
  for (const [id, challenge] of challenges) if (challenge.expiresAt < now) challenges.delete(id);
}

async function verifyCaptcha(token: string): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY) return false;
  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token });
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
  if (!response.ok) return false;
  const result = await response.json() as { success?: boolean };
  return result.success === true;
}

export const issueAntiAbuseChallenge: RequestHandler = async (request, response, next) => {
  try {
    const challenge = issueChallenge();
    await record('CHALLENGE_ISSUED', hashIp(clientIp(request)), 0);
    response.json(challenge);
  } catch (error) { next(error); }
};

export const antiAbuseMiddleware: RequestHandler = async (request, _response, next) => {
  const ipHash = hashIp(clientIp(request));
  const key = fingerprint(request, ipHash);
  const now = Date.now();
  const recent = (limits.get(key) ?? []).filter((time) => time > now - 60_000);
  recent.push(now); limits.set(key, recent);
  if (recent.length > env.RATE_LIMIT_ANALYSES_PER_MIN) {
    await record('RATE_BLOCKED', ipHash, 100);
    next(new ApiError('RATE_BLOCKED', 'Too many analysis requests. Please try again shortly.', 429));
    return;
  }
  const state = stateFor(ipHash, request.sessionKeyHash);
  state.requests.push(now);
  const validPow = verifyChallenge(request.header('X-PoW-Challenge-Id'), request.header('X-PoW-Nonce'));
  if (validPow) { state.passed += 1; state.score = Math.max(0, state.score - 5); await record('CHALLENGE_PASSED', ipHash, state.score); }
  else { state.failed += 1; state.score = Math.min(100, state.score + 20); await record('CHALLENGE_FAILED', ipHash, state.score); }
  if (state.sessions.size > 5) state.score = Math.min(100, state.score + 15);
  const captchaToken = request.header('X-Captcha-Token');
  if (captchaToken && await verifyCaptcha(captchaToken)) {
    state.score = Math.max(0, state.score - 60); state.captchaUntil = now + 15 * 60_000; next(); return;
  }
  let quotaExceeded = false;
  if (request.sessionKeyHash) {
    try { quotaExceeded = await countRecentAnalyses(request.sessionKeyHash) >= env.SESSION_QUOTA_PER_24H; }
    catch { quotaExceeded = false; }
  }
  if ((state.score >= env.RISK_SCORE_CAPTCHA_THRESHOLD || quotaExceeded) && state.captchaUntil < now) {
    next(new ApiError('ANTI_ABUSE_CHALLENGE_REQUIRED', 'Untuk melindungi layanan dari penyalahgunaan, mohon selesaikan verifikasi singkat.', 403, { siteKey: env.TURNSTILE_SITE_KEY ?? null, provider: 'turnstile' }));
    return;
  }
  request.antiAbuseRisk = state.score;
  next();
};

export function startAntiAbuseCleanup(): NodeJS.Timeout {
  const timer = setInterval(() => {
    cleanupChallengeStore();
    void cleanupExpiredAntiAbuseEvents().catch(() => undefined);
  }, 30 * 60_000);
  timer.unref();
  return timer;
}