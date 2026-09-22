import type { EraId, Mood } from "@/types/music";

export interface Era {
  id: EraId;
  label: string;
  years: string;
  order: number;
}

export const ERAS: Era[] = [
  { id: "1800s", label: "1800s", years: "1800 – 1899", order: 0 },
  { id: "1990s", label: "1990s", years: "1990 – 1999", order: 1 },
  { id: "2000s", label: "2000s", years: "2000 – 2009", order: 2 },
  { id: "2015s", label: "2015s", years: "2015 – 2019", order: 3 },
  { id: "2026s", label: "2026s", years: "2026 – present", order: 4 },
];

export const ERA_BY_ID: Record<EraId, Era> = Object.fromEntries(
  ERAS.map((era) => [era.id, era])
) as Record<EraId, Era>;

export const DEFAULT_ERA: EraId = "2000s";

export const MOODS: { id: Mood; label: string }[] = [
  { id: "neutral", label: "Neutral" },
  { id: "happy", label: "Happy" },
  { id: "sad", label: "Sad" },
  { id: "chill", label: "Chill" },
  { id: "energetic", label: "Energetic" },
];
