"use client";

import { useEffect, useMemo, useState } from "react";
import type { EraId } from "@/types/music";
import { fetchEraPhotoPool, pickPhotoFromPool } from "@/lib/backgroundPhotos";

const HISTORY_SIZE = 3;

/**
 * Fetches the real-photo pool for an era (via /api/backgrounds, our
 * server-side Pixabay proxy) and deterministically picks one per song,
 * avoiding recent repeats. Returns null while loading or if photos are
 * unavailable — callers should fall back to the gradient-only look.
 */
export function useEraPhoto(era: EraId, songId: string | null): string | null {
  const [pool, setPool] = useState<string[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [activeUrl, setActiveUrl] = useState<string | null>(null);

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
