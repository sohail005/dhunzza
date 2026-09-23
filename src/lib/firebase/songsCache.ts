"use client";

/**
 * Module-level cache for the full song list. Every screen that needs "all
 * songs" (player tune-in, admin dashboard, the browse-all overlay) shares
 * this instead of each independently issuing its own Firestore
 * getDocs(collection("songs")) — one network round trip serves all of them,
 * and subsequent callers reuse the in-memory result until a mutation
 * (upsert/remove) patches it in place.
 */
import type { Song } from "@/types/music";
import { fetchAllSongsOnce } from "@/lib/firebase/songs";
import { debugLog } from "@/lib/firebase/debugLog";

let cachedSongs: Song[] | null = null;
let inFlight: Promise<Song[]> | null = null;
const listeners = new Set<(songs: Song[]) => void>();

function notify() {
  if (!cachedSongs) return;
  for (const listener of listeners) listener(cachedSongs);
}

/** Returns the cached song list, fetching it once if not already loaded/loading. */
export async function getSongsOnce(): Promise<Song[]> {
  if (cachedSongs) {
    debugLog("songsCache", `cache hit (${cachedSongs.length} songs)`);
    return cachedSongs;
  }
  if (inFlight) {
    debugLog("songsCache", "awaiting in-flight fetch");
    return inFlight;
  }
  debugLog("songsCache", "cache miss — fetching all songs");
  inFlight = fetchAllSongsOnce()
    .then((songs) => {
      cachedSongs = songs;
      inFlight = null;
      return songs;
    })
    .catch((error) => {
      inFlight = null;
      throw error;
    });
  return inFlight;
}

/** Current cached songs, if already loaded (does not trigger a fetch). */
export function getCachedSongs(): Song[] | null {
  return cachedSongs;
}

/** Subscribes to cache updates; immediately invoked with the current value if already loaded. */
export function subscribeSongsCache(listener: (songs: Song[]) => void): () => void {
  listeners.add(listener);
  if (cachedSongs) listener(cachedSongs);
  return () => {
    listeners.delete(listener);
  };
}

/** Adds or replaces one song in the cache (newest first) without refetching the rest. */
export function upsertSongInCache(song: Song): void {
  if (!cachedSongs) return;
  const existingIndex = cachedSongs.findIndex((s) => s.id === song.id);
  cachedSongs =
    existingIndex === -1
      ? [song, ...cachedSongs]
      : cachedSongs.map((s) => (s.id === song.id ? song : s));
  debugLog("songsCache", `upsert ${song.id}`);
  notify();
}

/** Removes one song from the cache without refetching the rest. */
export function removeSongFromCache(songId: string): void {
  if (!cachedSongs) return;
  cachedSongs = cachedSongs.filter((s) => s.id !== songId);
  debugLog("songsCache", `remove ${songId}`);
  notify();
}
