"use client";

/**
 * Resolves audio/thumbnail RTDB paths to playable blob: URLs, backed by two
 * cache layers: an in-memory LRU (instant reuse within a session) and a
 * persistent Cache Storage layer (survives reloads/new tabs on this device
 * — see persistentMediaCache.ts). Realtime Database bills per byte
 * downloaded regardless of who's asking, so a song already streamed on this
 * device should never be pulled from RTDB again.
 */
import { fetchSongAudio, fetchSongThumbnail } from "@/lib/firebase/songs";
import { persistedAudio, persistedThumbnails } from "@/lib/firebase/persistentMediaCache";
import { debugLog } from "@/lib/firebase/debugLog";

// Audio blob URLs are large in underlying memory — cap how many stay
// resident so a long listening session can't grow unbounded. Evicted
// entries have their blob: URL revoked (see makeLruCache's onEvict).
const AUDIO_CACHE_LIMIT = 6;
// Thumbnails are small (embedded ID3 cover art, typically <200KB) — a
// higher cap costs little and covers a full song-list browse session.
const THUMBNAIL_CACHE_LIMIT = 100;

function makeLruCache<K, V>(limit: number, onEvict?: (key: K, value: V) => void) {
  const map = new Map<K, V>();
  return {
    get(key: K): V | undefined {
      const value = map.get(key);
      if (value === undefined) return undefined;
      // Refresh recency: re-insert so it's last (most-recently-used).
      map.delete(key);
      map.set(key, value);
      return value;
    },
    set(key: K, value: V): void {
      map.delete(key);
      map.set(key, value);
      if (map.size > limit) {
        const oldestKey = map.keys().next().value;
        if (oldestKey !== undefined) {
          const oldestValue = map.get(oldestKey);
          map.delete(oldestKey);
          if (onEvict && oldestValue !== undefined) onEvict(oldestKey, oldestValue);
        }
      }
    },
    delete(key: K): void {
      map.delete(key);
    },
  };
}

function revokeIfBlobUrl(url: string | null | undefined): void {
  if (url && url.startsWith("blob:")) URL.revokeObjectURL(url);
}

const audioCache = makeLruCache<string, Promise<string>>(AUDIO_CACHE_LIMIT, (_key, promise) => {
  promise.then(revokeIfBlobUrl).catch(() => {});
});
const thumbnailCache = makeLruCache<string, Promise<string | null>>(THUMBNAIL_CACHE_LIMIT, (_key, promise) => {
  promise.then(revokeIfBlobUrl).catch(() => {});
});

/** Converts a data: URI (as produced by fetchSongAudio/fetchSongThumbnail) into a Blob without a network round trip. */
async function dataUriToBlob(dataUri: string): Promise<Blob> {
  const response = await fetch(dataUri);
  return response.blob();
}

/** Resolves a song's audio to a playable blob: URL, checking the in-memory then persistent cache before hitting RTDB. */
export function getCachedSongAudio(audioPath: string): Promise<string> {
  const cached = audioCache.get(audioPath);
  if (cached) {
    debugLog("mediaCache", `audio cache hit: ${audioPath}`);
    return cached;
  }

  const promise = (async () => {
    const persisted = await persistedAudio.get(audioPath);
    if (persisted) {
      debugLog("mediaCache", `audio persistent-cache hit: ${audioPath}`);
      return URL.createObjectURL(persisted);
    }

    debugLog("mediaCache", `audio cache miss — fetching from RTDB: ${audioPath}`);
    const dataUri = await fetchSongAudio(audioPath);
    const blob = await dataUriToBlob(dataUri);
    persistedAudio.set(audioPath, blob).catch(() => {});
    return URL.createObjectURL(blob);
  })().catch((error) => {
    // Don't cache a failed resolution — let the next attempt retry.
    audioCache.delete(audioPath);
    throw error;
  });

  audioCache.set(audioPath, promise);
  return promise;
}

/** Resolves a song's thumbnail to a displayable blob: URL, checking the in-memory then persistent cache before hitting RTDB. */
export function getCachedSongThumbnail(thumbnailPath: string): Promise<string | null> {
  const cached = thumbnailCache.get(thumbnailPath);
  if (cached) {
    debugLog("mediaCache", `thumbnail cache hit: ${thumbnailPath}`);
    return cached;
  }

  const promise = (async () => {
    const persisted = await persistedThumbnails.get(thumbnailPath);
    if (persisted) {
      debugLog("mediaCache", `thumbnail persistent-cache hit: ${thumbnailPath}`);
      return URL.createObjectURL(persisted);
    }

    debugLog("mediaCache", `thumbnail cache miss — fetching from RTDB: ${thumbnailPath}`);
    const dataUri = await fetchSongThumbnail(thumbnailPath);
    if (!dataUri) return null;
    const blob = await dataUriToBlob(dataUri);
    persistedThumbnails.set(thumbnailPath, blob).catch(() => {});
    return URL.createObjectURL(blob);
  })().catch((error) => {
    thumbnailCache.delete(thumbnailPath);
    throw error;
  });

  thumbnailCache.set(thumbnailPath, promise);
  return promise;
}
