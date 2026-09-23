"use client";

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from "firebase/firestore";
import { get, ref as dbRef, remove as dbRemove, set as dbSet } from "firebase/database";
import { auth, db, rtdb } from "@/lib/firebase/config";
import type { EraId, Mood, Song } from "@/types/music";
import { DEFAULT_ERA } from "@/lib/eras";
import { debugLog } from "@/lib/firebase/debugLog";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

// Realtime Database rejects any single string value over 10,485,760 UTF-8
// bytes. Base64-encoding a MAX_UPLOAD_BYTES file inflates it past that
// (~4/3 the raw size), so the encoded audio is split into chunks — each
// its own string value, well under the per-value cap — and rejoined on
// playback. The combined payload isn't subject to the same per-value limit.
const BASE64_CHUNK_SIZE = 6 * 1024 * 1024; // base64 is ASCII, so chars === UTF-8 bytes here

function chunkBase64(base64: string): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < base64.length; i += BASE64_CHUNK_SIZE) {
    chunks.push(base64.slice(i, i + BASE64_CHUNK_SIZE));
  }
  return chunks;
}

function toEpochMs(value: unknown): number {
  return value instanceof Timestamp ? value.toMillis() : Date.now();
}

const VALID_ERAS = new Set<EraId>(["1800s", "1990s", "2000s", "2015s", "2026s"]);
const VALID_MOODS = new Set<Mood>(["happy", "sad", "chill", "energetic", "neutral"]);

function mapSongDoc(id: string, data: Record<string, unknown>): Song {
  const rawEra = data.era;
  const era: EraId =
    typeof rawEra === "string" && VALID_ERAS.has(rawEra as EraId) ? (rawEra as EraId) : DEFAULT_ERA;
  const rawMood = data.mood;
  const mood: Mood | null =
    typeof rawMood === "string" && VALID_MOODS.has(rawMood as Mood) ? (rawMood as Mood) : null;

  return {
    id,
    title: String(data.title ?? "Untitled"),
    artist: typeof data.artist === "string" ? data.artist : null,
    era,
    mood,
    background: typeof data.background === "string" ? data.background : null,
    audioPath: String(data.audioPath ?? ""),
    thumbnailPath: typeof data.thumbnailPath === "string" ? data.thumbnailPath : null,
    duration: typeof data.duration === "number" ? data.duration : null,
    createdAt: toEpochMs(data.createdAt),
    createdBy: String(data.createdBy ?? ""),
  };
}

export async function fetchAllSongsOnce(): Promise<Song[]> {
  debugLog("songs", "getDocs: full songs collection read");
  const snapshot = await getDocs(collection(db, "songs"));
  return snapshot.docs.map((docSnap) => mapSongDoc(docSnap.id, docSnap.data()));
}

/** Looks up a single song by id — used by the song-request chat's "Play"
 * button on a "your song was added" notification, which only has the id. */
export async function fetchSongById(songId: string): Promise<Song | null> {
  const snapshot = await getDoc(doc(db, "songs", songId));
  if (!snapshot.exists()) return null;
  return mapSongDoc(snapshot.id, snapshot.data());
}

/**
 * Live-watches for songs uploaded after `sinceEpochMs`, firing `onNewSong`
 * once per song as it appears — used to surface a "Recently Added" toast
 * without polling. Returns an unsubscribe function.
 */
export function subscribeToNewSongs(
  sinceEpochMs: number,
  onNewSong: (song: Song) => void
): () => void {
  const q = query(
    collection(db, "songs"),
    where("createdAt", ">", Timestamp.fromMillis(sinceEpochMs)),
    orderBy("createdAt", "asc")
  );
  debugLog("songs", "onSnapshot: subscribing to new-songs listener");
  const unsubscribe = onSnapshot(q, (snapshot) => {
    for (const change of snapshot.docChanges()) {
      if (change.type === "added") {
        debugLog("songs", `onSnapshot: new song ${change.doc.id}`);
        onNewSong(mapSongDoc(change.doc.id, change.doc.data()));
      }
    }
  });
  return () => {
    debugLog("songs", "onSnapshot: unsubscribing new-songs listener");
    unsubscribe();
  };
}

/**
 * Resolves a song's `audioPath` to a playable data: URI. Fetches the
 * base64 payload from Realtime Database lazily — only when a song is
 * actually about to play, not when listing/browsing songs.
 */
export async function fetchSongAudio(audioPath: string): Promise<string> {
  debugLog("songs", `get: audio RTDB read ${audioPath}`);
  const snapshot = await get(dbRef(rtdb, audioPath));
  const value = snapshot.val() as { data?: string | string[]; contentType?: string } | null;
  if (!value?.data) throw new Error("This song's audio file is missing.");
  const base64 = Array.isArray(value.data) ? value.data.join("") : value.data;
  return `data:${value.contentType || "audio/mpeg"};base64,${base64}`;
}

/** Resolves a song's `thumbnailPath` to a displayable data: URI. */
export async function fetchSongThumbnail(thumbnailPath: string): Promise<string | null> {
  debugLog("songs", `get: thumbnail RTDB read ${thumbnailPath}`);
  const snapshot = await get(dbRef(rtdb, thumbnailPath));
  const value = snapshot.val() as { data?: string; contentType?: string } | null;
  if (!value?.data) return null;
  return `data:${value.contentType || "image/jpeg"};base64,${value.data}`;
}

/** Reads an audio file's duration in seconds by loading it into a throwaway <audio> element. */
export function readAudioDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const audio = new Audio();
    const cleanup = () => URL.revokeObjectURL(objectUrl);
    audio.addEventListener("loadedmetadata", () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : null;
      cleanup();
      resolve(duration);
    });
    audio.addEventListener("error", () => {
      cleanup();
      resolve(null);
    });
    audio.src = objectUrl;
  });
}

/** Reads a File into just its base64 payload (no "data:...;base64," prefix). */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/** De-syncsafes a 4-byte ID3v2 size field (each byte only uses its low 7 bits). */
function readSyncsafeInt(view: DataView, offset: number): number {
  return (
    ((view.getUint8(offset) & 0x7f) << 21) |
    ((view.getUint8(offset + 1) & 0x7f) << 14) |
    ((view.getUint8(offset + 2) & 0x7f) << 7) |
    (view.getUint8(offset + 3) & 0x7f)
  );
}

interface EmbeddedCoverArt {
  data: string; // base64
  contentType: string;
}

/**
 * Pulls the embedded cover art (ID3v2 APIC frame) out of an MP3 file, if
 * present. Only reads the ID3v2 header block, not the whole file.
 */
async function extractEmbeddedCoverArt(file: File): Promise<EmbeddedCoverArt | null> {
  try {
    const headerBuffer = await file.slice(0, 10).arrayBuffer();
    const header = new DataView(headerBuffer);
    const isId3 =
      header.getUint8(0) === 0x49 && header.getUint8(1) === 0x44 && header.getUint8(2) === 0x33;
    if (!isId3) return null;

    const majorVersion = header.getUint8(3);
    const tagSize = readSyncsafeInt(header, 6);
    if (tagSize <= 0) return null;

    const tagBuffer = await file.slice(10, 10 + tagSize).arrayBuffer();
    const view = new DataView(tagBuffer);
    const bytes = new Uint8Array(tagBuffer);

    let offset = 0;
    while (offset + 10 <= tagBuffer.byteLength) {
      const frameId = String.fromCharCode(
        view.getUint8(offset),
        view.getUint8(offset + 1),
        view.getUint8(offset + 2),
        view.getUint8(offset + 3)
      );
      if (frameId === "\0\0\0\0") break;

      const frameSize =
        majorVersion >= 4
          ? readSyncsafeInt(view, offset + 4)
          : view.getUint32(offset + 4, false);
      const frameStart = offset + 10;

      if (frameId === "APIC" && frameSize > 0 && frameStart + frameSize <= tagBuffer.byteLength) {
        const frame = bytes.subarray(frameStart, frameStart + frameSize);
        const encoding = frame[0];
        let cursor = 1;
        let mimeEnd = cursor;
        while (mimeEnd < frame.length && frame[mimeEnd] !== 0) mimeEnd++;
        const mimeType = new TextDecoder("latin1").decode(frame.subarray(cursor, mimeEnd)) || "image/jpeg";
        cursor = mimeEnd + 1;
        cursor += 1; // picture type byte

        const isUtf16 = encoding === 1 || encoding === 2;
        if (isUtf16) {
          while (cursor + 1 < frame.length && !(frame[cursor] === 0 && frame[cursor + 1] === 0)) {
            cursor += 2;
          }
          cursor += 2;
        } else {
          while (cursor < frame.length && frame[cursor] !== 0) cursor++;
          cursor += 1;
        }

        const imageBytes = frame.subarray(Math.min(cursor, frame.length));
        if (imageBytes.length === 0) return null;
        return { data: bytesToBase64(imageBytes), contentType: mimeType };
      }

      offset = frameStart + frameSize;
    }
    return null;
  } catch {
    return null;
  }
}

interface UploadSongInput {
  file: File;
  title: string;
  artist: string | null;
  era: EraId;
  mood?: Mood | null;
  background?: string | null;
  onProgress?: (pct: number) => void;
}

export async function uploadSong({
  file,
  title,
  artist,
  era,
  mood = null,
  background = null,
  onProgress,
}: UploadSongInput): Promise<Song> {
  const currentUser = auth.currentUser;
  if (!currentUser?.email) throw new Error("You must be signed in as an admin to upload.");

  if (!file.type.startsWith("audio/")) {
    throw new Error("File must be an audio file (MP3).");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`File is too large (max ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))}MB).`);
  }
  const trimmedTitle = title.trim();
  if (!trimmedTitle) throw new Error("Song title cannot be empty.");
  if (!era) throw new Error("An era must be selected.");

  const songRef = doc(collection(db, "songs"));
  const songId = songRef.id;
  const audioPath = `songsAudio/${songId}`;
  const thumbnailPath = `songsThumbnails/${songId}`;

  onProgress?.(10);
  const duration = await readAudioDuration(file);
  onProgress?.(25);
  const coverArt = await extractEmbeddedCoverArt(file);
  onProgress?.(35);
  const base64Data = await fileToBase64(file);
  onProgress?.(60);

  const chunks = chunkBase64(base64Data);
  await dbSet(dbRef(rtdb, audioPath), {
    data: chunks.length > 1 ? chunks : base64Data,
    contentType: file.type,
  });
  onProgress?.(80);

  if (coverArt) {
    await dbSet(dbRef(rtdb, thumbnailPath), coverArt).catch(() => {
      // Cover art is a nice-to-have — don't fail the whole upload over it.
    });
  }
  onProgress?.(90);

  try {
    const song: Omit<Song, "createdAt"> & { createdAt: unknown } = {
      id: songId,
      title: trimmedTitle,
      artist: artist?.trim() || null,
      era,
      mood,
      background,
      audioPath,
      thumbnailPath: coverArt ? thumbnailPath : null,
      duration,
      createdAt: serverTimestamp(),
      createdBy: currentUser.email,
    };
    await setDoc(songRef, song);
    onProgress?.(100);
    return { ...song, createdAt: Date.now() };
  } catch (error) {
    // Firestore write failed after the audio made it to Realtime Database
    // — clean up the orphaned entries rather than leaving them unreferenced.
    await dbRemove(dbRef(rtdb, audioPath)).catch(() => {});
    if (coverArt) await dbRemove(dbRef(rtdb, thumbnailPath)).catch(() => {});
    throw error;
  }
}

export async function deleteSong(
  songId: string,
  audioPath: string,
  thumbnailPath?: string | null
): Promise<void> {
  await deleteDoc(doc(db, "songs", songId));
  await dbRemove(dbRef(rtdb, audioPath)).catch(() => {
    // Entry already gone / never finished uploading — the metadata delete
    // above is what matters for the app; ignore.
  });
  if (thumbnailPath) {
    await dbRemove(dbRef(rtdb, thumbnailPath)).catch(() => {});
  }
}
