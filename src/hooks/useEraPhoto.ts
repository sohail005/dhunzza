"use client";

import { useEffect, useMemo, useState } from "react";
import type { EraId } from "@/types/music";
import { fetchEraPhotoPool, pickPhotoFromPool, seedEraPhotoPool } from "@/lib/backgroundPhotos";

const HISTORY_SIZE = 3;

export interface InitialEraPhoto {
  era: EraId;
  pool: string[];
  url: string | null;
}

/**
 * Fetches the real-photo pool for an era (via /api/backgrounds, our
 * server-side Pixabay proxy) and deterministically picks one per song,
 * avoiding recent repeats. Returns null while loading or if photos are
 * unavailable — callers should fall back to the gradient-only look.
 *
 * `initial` lets the caller seed the very first render with a pool (and
 * picked URL) the server already fetched, so the first paint doesn't have
 * to wait on a client-side fetch chain — see EraBackground.tsx/layout.tsx.
 * It's only useful on the initial mount (same as a lazy useState default);
 * era/songId changes after that always go through the normal fetch path.
 */
export function useEraPhoto(era: EraId, songId: string | null, initial?: InitialEraPhoto): string | null {
  const [pool, setPool] = useState<string[]>(() => {
    if (initial && initial.era === era && initial.pool.length > 0) {
      seedEraPhotoPool(initial.era, initial.pool);
      return initial.pool;
    }
    return [];
  });
  const [history, setHistory] = useState<string[]>([]);
  const [activeUrl, setActiveUrl] = useState<string | null>(() =>
    initial && initial.era === era ? initial.url : null
  );

  useEffect(() => {
    let cancelled = false;
    fetchEraPhotoPool(era).then((urls) => {
      if (!cancelled) setPool(urls);
    });
    return () => {
      cancelled = true;
    };
  }, [era]);

  // Only re-pick when the era/song identity or the pool itself changes —
  // `history` is read for "avoid repeats" but excluded from deps for the
  // same reason as useEraBackground.ts: including it would create a
  // pick -> record -> exclude -> re-pick feedback loop every render.
  const pickedUrl = useMemo(() => {
    return pickPhotoFromPool(pool, songId ?? era, history);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately excludes `history`; see comment above
  }, [pool, songId, era]);

  useEffect(() => {
    if (!pickedUrl) return;
    Promise.resolve().then(() => {
      setActiveUrl(pickedUrl);
      setHistory((prev) => (prev[prev.length - 1] === pickedUrl ? prev : [...prev, pickedUrl].slice(-HISTORY_SIZE)));
    });
  }, [pickedUrl]);

  return activeUrl;
}
