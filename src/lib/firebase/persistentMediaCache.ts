"use client";

/**
 * Persists resolved audio/thumbnail blobs in the browser's Cache Storage,
 * surviving page reloads and new tabs on the same device. Realtime Database
 * bills for every byte downloaded regardless of who's asking — a page
 * reload alone shouldn't force a song already streamed on this device to be
 * pulled from RTDB again. Byte-budgeted with LRU eviction tracked in
 * localStorage (Cache Storage itself has no query-by-recency API).
 */
import { debugLog } from "@/lib/firebase/debugLog";

const AUDIO_CACHE_NAME = "dhunzza-audio-v1";
const THUMBNAIL_CACHE_NAME = "dhunzza-thumbnails-v1";
const AUDIO_INDEX_KEY = "dhunzza.persisted-audio-index";
const THUMBNAIL_INDEX_KEY = "dhunzza.persisted-thumbnail-index";

// Audio is the dominant Realtime Database cost — worth budgeting real
// device storage for so repeat plays never re-hit the database.
const AUDIO_BUDGET_BYTES = 150 * 1024 * 1024;
// Thumbnails are small; a generous cap costs little.
const THUMBNAIL_BUDGET_BYTES = 20 * 1024 * 1024;

interface IndexEntry {
  key: string; // audioPath / thumbnailPath
  size: number;
  lastAccessed: number;
}

function supportsCacheStorage(): boolean {
  return typeof window !== "undefined" && "caches" in window;
}

function requestUrlFor(namespace: string, path: string): string {
  return `${window.location.origin}/__dhunzza-cache/${namespace}/${encodeURIComponent(path)}`;
}

function readIndex(storageKey: string): IndexEntry[] {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeIndex(storageKey: string, entries: IndexEntry[]): void {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(entries));
  } catch {
    // Best-effort — a failed index write only means eviction bookkeeping
    // drifts slightly; playback isn't affected.
  }
}

/** Evicts oldest-accessed entries until under budget, always keeping at
 * least the single most-recent entry even if it alone exceeds budget. */
async function evictUntilWithinBudget(
  cacheName: string,
  storageKey: string,
  budgetBytes: number,
  namespace: string
): Promise<void> {
  const entries = readIndex(storageKey).sort((a, b) => a.lastAccessed - b.lastAccessed);
  let total = entries.reduce((sum, e) => sum + e.size, 0);
  if (total <= budgetBytes) return;

  const cache = await caches.open(cacheName);
  while (total > budgetBytes && entries.length > 1) {
    const oldest = entries.shift();
    if (!oldest) break;
    total -= oldest.size;
    await cache.delete(requestUrlFor(namespace, oldest.key)).catch(() => {});
    debugLog("persistentMediaCache", `evicted ${namespace}:${oldest.key} (LRU, over budget)`);
  }
  writeIndex(storageKey, entries);
}

async function persist(
  cacheName: string,
  storageKey: string,
  budgetBytes: number,
  namespace: string,
  key: string,
  blob: Blob
): Promise<void> {
  if (!supportsCacheStorage()) return;
  try {
    const cache = await caches.open(cacheName);
    await cache.put(requestUrlFor(namespace, key), new Response(blob, { headers: { "Content-Type": blob.type } }));

    const entries = readIndex(storageKey).filter((e) => e.key !== key);
    entries.push({ key, size: blob.size, lastAccessed: Date.now() });
    writeIndex(storageKey, entries);
    await evictUntilWithinBudget(cacheName, storageKey, budgetBytes, namespace);
    debugLog("persistentMediaCache", `persisted ${namespace}:${key} (${blob.size} bytes)`);
  } catch (error) {
    // Quota exceeded, private browsing restrictions, etc. — persistence is
    // a nice-to-have; playback must keep working without it.
    debugLog("persistentMediaCache", `persist failed for ${namespace}:${key}`, error);
  }
}

async function retrieve(cacheName: string, storageKey: string, namespace: string, key: string): Promise<Blob | null> {
  if (!supportsCacheStorage()) return null;
  try {
    const cache = await caches.open(cacheName);
    const match = await cache.match(requestUrlFor(namespace, key));
    if (!match) return null;
    const blob = await match.blob();

    const entries = readIndex(storageKey);
    const existing = entries.find((e) => e.key === key);
    if (existing) {
      existing.lastAccessed = Date.now();
      writeIndex(storageKey, entries);
    }

    debugLog("persistentMediaCache", `persistent cache hit ${namespace}:${key}`);
    return blob;
  } catch {
    return null;
  }
}

export const persistedAudio = {
  get: (audioPath: string) => retrieve(AUDIO_CACHE_NAME, AUDIO_INDEX_KEY, "audio", audioPath),
  set: (audioPath: string, blob: Blob) =>
    persist(AUDIO_CACHE_NAME, AUDIO_INDEX_KEY, AUDIO_BUDGET_BYTES, "audio", audioPath, blob),
};

export const persistedThumbnails = {
  get: (thumbnailPath: string) => retrieve(THUMBNAIL_CACHE_NAME, THUMBNAIL_INDEX_KEY, "thumbnail", thumbnailPath),
  set: (thumbnailPath: string, blob: Blob) =>
    persist(THUMBNAIL_CACHE_NAME, THUMBNAIL_INDEX_KEY, THUMBNAIL_BUDGET_BYTES, "thumbnail", thumbnailPath, blob),
};
