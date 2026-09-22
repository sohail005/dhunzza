import type { EraId, Mood } from "@/types/music";

export interface BackgroundVariant {
  id: string;
  era: EraId;
  mood: Mood | "neutral";
  /** CSS `background-image` value. */
  gradient: string;
  /** Text/UI accent color to pair with this variant for contrast. */
  accent: string;
  grain?: boolean;
}

// Hand-tuned per era/mood since no curated photography is available —
// each variant should still read as "that decade" at a glance.
const VARIANTS: BackgroundVariant[] = [
  // --- 1800s: sepia, candlelight, parchment ---
  {
    id: "1800s-neutral-01",
    era: "1800s",
    mood: "neutral",
    gradient:
      "radial-gradient(circle at 30% 20%, #4a3520 0%, #2a1c10 45%, #140c06 100%)",
    accent: "#d8b672",
    grain: true,
  },
  {
    id: "1800s-chill-01",
    era: "1800s",
    mood: "chill",
    gradient:
      "linear-gradient(160deg, #3a2a18 0%, #241708 55%, #0f0a05 100%)",
    accent: "#c9a15f",
    grain: true,
  },
  {
    id: "1800s-sad-01",
    era: "1800s",
    mood: "sad",
    gradient:
      "radial-gradient(circle at 70% 80%, #33291e 0%, #1a1108 60%, #0a0705 100%)",
    accent: "#9c8355",
    grain: true,
  },
  {
    id: "1800s-happy-01",
    era: "1800s",
    mood: "happy",
    gradient:
      "linear-gradient(140deg, #5a3f22 0%, #3a2712 50%, #1c1208 100%)",
    accent: "#e6c988",
    grain: true,
  },

  // --- 1990s: warm cassette amber, lo-fi nostalgia ---
  {
    id: "1990s-neutral-01",
    era: "1990s",
    mood: "neutral",
    gradient:
      "linear-gradient(135deg, #7a3b1e 0%, #b0532a 40%, #3d1f12 100%)",
    accent: "#ffb668",
    grain: true,
  },
  {
    id: "1990s-chill-01",
    era: "1990s",
    mood: "chill",
    gradient:
      "radial-gradient(circle at 25% 75%, #6b3d24 0%, #40230f 55%, #1a0f08 100%)",
    accent: "#ffcf94",
    grain: true,
  },
  {
    id: "1990s-happy-01",
    era: "1990s",
    mood: "happy",
    gradient:
      "linear-gradient(120deg, #d97a2e 0%, #b23a52 50%, #4a1830 100%)",
    accent: "#ffd27a",
  },
  {
    id: "1990s-sad-01",
    era: "1990s",
    mood: "sad",
    gradient:
      "linear-gradient(160deg, #4b3a2c 0%, #2c2119 55%, #14100c 100%)",
    accent: "#c9a878",
    grain: true,
  },
  {
    id: "1990s-energetic-01",
    era: "1990s",
    mood: "energetic",
    gradient:
      "conic-gradient(from 210deg at 50% 50%, #e0651f, #b0532a, #7a3b1e, #e0651f)",
    accent: "#ffb668",
  },

  // --- 2000s: Y2K color bursts / nostalgic rain ---
  {
    id: "2000s-neutral-01",
    era: "2000s",
    mood: "neutral",
    gradient:
      "linear-gradient(135deg, #1e0f3d 0%, #3d1f5c 45%, #0d0620 100%)",
    accent: "#7ee8ff",
  },
  {
    id: "2000s-happy-01",
    era: "2000s",
    mood: "happy",
    gradient:
      "radial-gradient(circle at 30% 30%, #ff2ea6 0%, #7a1fd6 45%, #14082f 100%)",
    accent: "#7ee8ff",
  },
  {
    id: "2000s-happy-02",
    era: "2000s",
    mood: "happy",
    gradient:
      "conic-gradient(from 120deg at 50% 50%, #ff2ea6, #29d6ff, #7a1fd6, #ff2ea6)",
    accent: "#fff27a",
  },
  {
    id: "2000s-sad-01",
    era: "2000s",
    mood: "sad",
    gradient:
      "linear-gradient(170deg, #1c2733 0%, #10161e 55%, #05070a 100%)",
    accent: "#8fb4d9",
  },
  {
    id: "2000s-chill-01",
    era: "2000s",
    mood: "chill",
    gradient:
      "linear-gradient(140deg, #1f2e4a 0%, #33255c 55%, #120a26 100%)",
    accent: "#a7c9ff",
  },
  {
    id: "2000s-energetic-01",
    era: "2000s",
    mood: "energetic",
    gradient:
      "radial-gradient(circle at 60% 40%, #29d6ff 0%, #ff2ea6 45%, #14082f 100%)",
    accent: "#fff27a",
  },

  // --- 2015s: streaming-era teal/violet, festival lights ---
  {
    id: "2015s-neutral-01",
    era: "2015s",
    mood: "neutral",
    gradient:
      "linear-gradient(135deg, #241b4a 0%, #3d2a6e 45%, #0f0a22 100%)",
    accent: "#b98cff",
  },
  {
    id: "2015s-happy-01",
    era: "2015s",
    mood: "happy",
    gradient:
      "radial-gradient(circle at 35% 25%, #ff5ec4 0%, #7a3dff 45%, #160b2e 100%)",
    accent: "#ffd166",
  },
  {
    id: "2015s-chill-01",
    era: "2015s",
    mood: "chill",
    gradient:
      "linear-gradient(150deg, #1c2a4a 0%, #241b4a 55%, #0a0718 100%)",
    accent: "#8ec7ff",
  },
  {
    id: "2015s-sad-01",
    era: "2015s",
    mood: "sad",
    gradient:
      "linear-gradient(170deg, #21203a 0%, #131226 55%, #07060f 100%)",
    accent: "#9a8fd9",
  },
  {
    id: "2015s-energetic-01",
    era: "2015s",
    mood: "energetic",
    gradient:
      "conic-gradient(from 90deg at 50% 50%, #7a3dff, #ff5ec4, #3dd9ff, #7a3dff)",
    accent: "#ffd166",
  },

  // --- 2026s: near-future, holographic/chrome AI aesthetic ---
  {
    id: "2026s-neutral-01",
    era: "2026s",
    mood: "neutral",
    gradient:
      "linear-gradient(135deg, #0a0f1e 0%, #131b33 45%, #05070f 100%)",
    accent: "#8fe8ff",
  },
  {
    id: "2026s-energetic-01",
    era: "2026s",
    mood: "energetic",
    gradient:
      "conic-gradient(from 220deg at 50% 50%, #8fe8ff, #ff8ff0, #b8ff8f, #ffe98f, #8fe8ff)",
    accent: "#ff8ff0",
  },
  {
    id: "2026s-energetic-02",
    era: "2026s",
    mood: "energetic",
    gradient:
      "radial-gradient(circle at 50% 30%, #c9d6ff 0%, #7a5fff 40%, #12081f 75%)",
    accent: "#c9d6ff",
  },
  {
    id: "2026s-happy-01",
    era: "2026s",
    mood: "happy",
    gradient:
      "linear-gradient(120deg, #ffe98f 0%, #ff8ff0 45%, #8fe8ff 100%)",
    accent: "#0a0f1e",
  },
  {
    id: "2026s-chill-01",
    era: "2026s",
    mood: "chill",
    gradient:
      "linear-gradient(150deg, #0c1a2e 0%, #16243f 55%, #050a14 100%)",
    accent: "#9fd4ff",
  },
  {
    id: "2026s-sad-01",
    era: "2026s",
    mood: "sad",
    gradient:
      "linear-gradient(170deg, #12131e 0%, #090a12 55%, #030307 100%)",
    accent: "#7d8ab5",
  },
];

const VARIANTS_BY_ERA: Record<EraId, BackgroundVariant[]> = VARIANTS.reduce(
  (acc, variant) => {
    (acc[variant.era] ??= []).push(variant);
    return acc;
  },
  {} as Record<EraId, BackgroundVariant[]>
);

export const VARIANT_BY_ID: Record<string, BackgroundVariant> = Object.fromEntries(
  VARIANTS.map((variant) => [variant.id, variant])
);

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Picks a background variant for the given era/mood/song, avoiding
 * anything in `recentIds`. Prefers an exact era+mood match, falls back to
 * era-only, and is deterministic per song id so the same song always lands
 * on the same variant (stable across reloads) while spreading different
 * songs across the era's collection.
 */
export function pickBackground(
  era: EraId,
  mood: Mood | null,
  songId: string,
  recentIds: string[] = []
): BackgroundVariant {
  const pool = VARIANTS_BY_ERA[era] ?? VARIANTS;
  const moodMatches = mood ? pool.filter((v) => v.mood === mood) : [];
  const candidates = moodMatches.length > 0 ? moodMatches : pool;

  const notRecent = candidates.filter((v) => !recentIds.includes(v.id));
  const finalPool = notRecent.length > 0 ? notRecent : candidates;

  const index = hashString(songId) % finalPool.length;
  return finalPool[index];
}

export function getBackgroundById(id: string): BackgroundVariant | null {
  return VARIANT_BY_ID[id] ?? null;
}
