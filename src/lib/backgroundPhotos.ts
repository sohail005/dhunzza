import type { EraId } from "@/types/music";

// In-memory client-side cache so switching back to an already-visited era
// (or replaying songs within it) doesn't re-hit our /api/backgrounds route.
const poolCache = new Map<EraId, string[]>();
const inFlight = new Map<EraId, Promise<string[]>>();

/** Fetches (and caches) the pool of real photo URLs for an era, via our server-side Pixabay proxy. */
export async function fetchEraPhotoPool(era: EraId): Promise<string[]> {
  const cached = poolCache.get(era);
  if (cached) return cached;

  const pending = inFlight.get(era);
  if (pending) return pending;

  const promise = (async () => {
    try {
      const response = await fetch(`/api/backgrounds?era=${encodeURIComponent(era)}`);
      if (!response.ok) return [];
      const data = (await response.json()) as { urls?: string[] };
      const urls = data.urls ?? [];
      if (urls.length > 0) poolCache.set(era, urls);
      return urls;
    } catch {
      return [];
    } finally {
      inFlight.delete(era);
    }
  })();

  inFlight.set(era, promise);
  return promise;
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Deterministically picks a photo from the pool for a given seed (e.g. song id), avoiding recent repeats where possible. */
export function pickPhotoFromPool(pool: string[], seed: string, recentUrls: string[] = []): string | null {
  if (pool.length === 0) return null;
  const notRecent = pool.filter((url) => !recentUrls.includes(url));
  const candidates = notRecent.length > 0 ? notRecent : pool;
  return candidates[hashString(seed) % candidates.length];
}
