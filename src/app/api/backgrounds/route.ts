import "server-only";
import { NextResponse } from "next/server";
import { getClientIp, isRateLimited } from "@/lib/rateLimit";
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

const VALID_ERAS = new Set<EraId>(Object.keys(ERA_QUERIES) as EraId[]);

const RATE_LIMIT = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;
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

  const response = await fetch(`https://pixabay.com/api/?${params.toString()}`);
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

export async function GET(request: Request) {
  const ip = getClientIp(request);
  if (isRateLimited(`backgrounds:${ip}`, RATE_LIMIT, RATE_LIMIT_WINDOW_MS)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const era = searchParams.get("era");
  if (!era || !VALID_ERAS.has(era as EraId)) {
    return NextResponse.json({ error: "Invalid or missing era." }, { status: 400 });
  }
  const validEra = era as EraId;

  const cached = cache.get(validEra);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json({ urls: cached.urls });
  }

  try {
    const urls = await fetchEraPhotos(validEra);
    cache.set(validEra, { urls, fetchedAt: Date.now() });
    return NextResponse.json({ urls });
  } catch {
    // Serve a stale cache entry over an error if we have one — a slightly
    // outdated photo pool beats no photos at all.
    if (cached) return NextResponse.json({ urls: cached.urls });
    return NextResponse.json({ error: "Couldn't fetch background photos." }, { status: 502 });
  }
}
