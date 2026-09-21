import "server-only";

declare global {
  // eslint-disable-next-line no-var
  var __dhunzzaRateLimitHits: Map<string, number[]> | undefined;
}

const hits = globalThis.__dhunzzaRateLimitHits ?? new Map<string, number[]>();
globalThis.__dhunzzaRateLimitHits = hits;

/**
 * Simple in-memory sliding-window rate limiter, keyed by caller (usually an
 * IP). Same "reuse across warm serverless invocations via globalThis"
 * pattern as src/app/api/presence/route.ts — per-instance only, not shared
 * across regions/instances, but enough to blunt casual abuse of a small
 * single-region deployment.
 */
export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);

  if (recent.length >= limit) {
    hits.set(key, recent);
    return true;
  }

  recent.push(now);
  hits.set(key, recent);
  return false;
}

/** Best-effort client IP from standard proxy headers (Vercel sets x-forwarded-for). */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
