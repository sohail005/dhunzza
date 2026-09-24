import "server-only";
import type { EraId } from "@/types/music";

// Curated search terms so each era's photo pool actually looks like that
// decade, rather than generic "background" results.
const ERA_QUERIES: Record<EraId, string> = {
  "1800s": "vintage sepia old photograph",
  "1990s": "retro vintage cassette 90s",
  "2000s": "abstract colorful vibrant",
  "2015s": "concert festival lights",
  "2026s": "futuristic neon technology",
};

export const VALID_ERAS = new Set<EraId>(Object.keys(ERA_QUERIES) as EraId[]);

// Pixabay's terms require caching results (no more than 24h) instead of
// re-requesting the same query repeatedly — this comfortably respects that
// while still refreshing the pool periodically for variety.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const PER_PAGE = 20;

interface CacheEntry {
  urls: string[];
  fetchedAt: number;
}

declare global {
  var __dhunzzaBackgroundCache: Map<EraId, CacheEntry> | undefined;
}

const cache = globalThis.__dhunzzaBackgroundCache ?? new Map<EraId, CacheEntry>();
globalThis.__dhunzzaBackgroundCache = cache;

async function fetchEraPhotos(era: EraId): Promise<string[]> {
  const apiKey = process.env.PIXABAYKEY;
  if (!apiKey) throw new Error("Missing PIXABAYKEY env var.");

  const params = new URLSearchParams({
    key: apiKey,
    q: ERA_QUERIES[era],
    image_type: "photo",
    orientation: "horizontal",
    safesearch: "true",
    per_page: String(PER_PAGE),
  });

  // Explicit revalidate window (matches CACHE_TTL_MS) so Next treats this as
  // static/ISR-cacheable data instead of opting the whole route (including
  // the root layout that prefetches it) into fully dynamic per-request
  // rendering — the in-memory `cache` Map above is the fast path at
  // runtime; this is what keeps the build/static-analysis story sane.
  const response = await fetch(`https://pixabay.com/api/?${params.toString()}`, {
    next: { revalidate: CACHE_TTL_MS / 1000 },
  });
  if (!response.ok) throw new Error(`Pixabay request failed (${response.status}).`);

  const data = (await response.json()) as { hits?: { webformatURL?: string }[] };
  // webformatURL (~640px) over largeImageURL (~1280px) — this renders at
  // 45% opacity under two more overlays on top (see EraBackground.tsx), so
  // the extra resolution is invisible; it was costing 250-500KB per photo
  // for detail nobody can see.
  const urls = (data.hits ?? [])
    .map((hit) => hit.webformatURL)
    .filter((url): url is string => Boolean(url));

  if (urls.length === 0) throw new Error("Pixabay returned no usable images.");
  return urls;
}

function getFreshCachedPool(era: EraId): string[] | null {
  const cached = cache.get(era);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.urls;
  return null;
}

/**
 * Fetches (or serves from cache) an era's photo pool, throwing if there's
 * no usable pool at all. Callers decide how to handle the error — the API
 * route falls back to a stale cache entry or a 502, while the root layout
 * (which prefetches the default era at render time so the client doesn't
 * have to round-trip through our own API first) just swallows it.
 */
export async function fetchOrGetCachedEraPhotoPool(era: EraId): Promise<string[]> {
  const fresh = getFreshCachedPool(era);
  if (fresh) return fresh;

  try {
    const urls = await fetchEraPhotos(era);
    cache.set(era, { urls, fetchedAt: Date.now() });
    return urls;
  } catch (error) {
    // Serve a stale cache entry over an error if we have one — a slightly
    // outdated photo pool beats no photos at all.
    const stale = cache.get(era);
    if (stale) return stale.urls;
    throw error;
  }
}

/** Best-effort variant for non-critical prefetches — never throws. */
export async function getEraPhotoPoolSafe(era: EraId): Promise<string[]> {
  try {
    return await fetchOrGetCachedEraPhotoPool(era);
  } catch {
    return [];
  }
}
