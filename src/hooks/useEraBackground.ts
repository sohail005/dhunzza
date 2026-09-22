"use client";

import { useEffect, useMemo, useState } from "react";
import type { EraId, Mood, Song } from "@/types/music";
import {
  getBackgroundById,
  pickBackground,
  type BackgroundVariant,
} from "@/lib/eraBackgrounds";
import { DEFAULT_ERA } from "@/lib/eras";

const HISTORY_SIZE = 3;

export interface EraBackgroundState {
  activeVariant: BackgroundVariant;
  previousVariant: BackgroundVariant | null;
  /** true only on the render where the era itself just changed — drives the "major" transition. */
  isEraTransition: boolean;
}

/**
 * Picks the background variant that should be showing right now, given the
 * current era and song, and tracks a short history so the same-looking
 * variant doesn't repeat back-to-back. Era changes get flagged separately
 * from song changes so the caller can use a longer/more dramatic
 * transition for the former and a subtle one for the latter.
 */
export function useEraBackground(currentEra: EraId | null, currentSong: Song | null): EraBackgroundState {
  const era = currentEra ?? currentSong?.era ?? DEFAULT_ERA;
  const songId = currentSong?.id ?? null;
  const mood: Mood | null = currentSong?.mood ?? null;
  const pinnedId = currentSong?.background ?? null;

  const [history, setHistory] = useState<string[]>([]);
  const [lastEra, setLastEra] = useState<EraId | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [previousVariant, setPreviousVariant] = useState<BackgroundVariant | null>(null);

  // Only re-pick when the era/song identity actually changes. `history` is
  // read for "avoid repeats" but must NOT be a dependency here — otherwise
  // picking a variant appends it to history, which changes this memo's
  // input, which picks a different variant, which appends again... an
  // infinite reactive loop that made the background flicker every render.
  const activeVariant = useMemo(() => {
    const pinned = pinnedId ? getBackgroundById(pinnedId) : null;
    if (pinned && pinned.era === era) return pinned;
    return pickBackground(era, mood, songId ?? era, history);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately excludes `history`; see comment above
  }, [era, songId, mood, pinnedId]);

  const isEraTransition = lastEra !== null && lastEra !== era;

  useEffect(() => {
    Promise.resolve().then(() => {
      if (activeId !== null && activeId !== activeVariant.id) {
        setPreviousVariant(getBackgroundById(activeId));
      }
      if (activeId !== activeVariant.id) setActiveId(activeVariant.id);
      setHistory((prev) =>
        prev[prev.length - 1] === activeVariant.id ? prev : [...prev, activeVariant.id].slice(-HISTORY_SIZE)
      );
      if (lastEra !== era) setLastEra(era);
    });
  }, [activeVariant.id, era, activeId, lastEra]);

  return { activeVariant, previousVariant, isEraTransition };
}
