export type EraId = "1800s" | "1990s" | "2000s" | "2015s" | "2026s";

export type Mood = "happy" | "sad" | "chill" | "energetic" | "neutral";

export interface Song {
  id: string;
  title: string;
  artist: string | null;
  era: EraId;
  mood: Mood | null;
  /** Optional pinned background-variant id (see src/lib/eraBackgrounds.ts). Falls back to smart selection when null. */
  background: string | null;
  /** Realtime Database path holding the base64-encoded audio (see src/lib/firebase/songs.ts). */
  audioPath: string;
  /** Realtime Database path holding the base64-encoded cover art extracted from the file's ID3 tags, if any. */
  thumbnailPath: string | null;
  duration: number | null;
  createdAt: number; // epoch ms
  createdBy: string;
}
