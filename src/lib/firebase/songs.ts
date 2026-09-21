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
import type { Category, Song } from "@/types/music";

// Realtime Database has no per-document size cap like Firestore, but a
// single JSON value should still stay well clear of its request-size
// limits — 10MB raw (~13.5MB once base64-encoded) comfortably fits a
// compressed 3-5 minute song while staying safely inside those limits.
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toEpochMs(value: unknown): number {
  return value instanceof Timestamp ? value.toMillis() : Date.now();
}

export async function fetchCategories(): Promise<Category[]> {
  const snapshot = await getDocs(collection(db, "categories"));
  return snapshot.docs
    .map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        name: String(data.name ?? docSnap.id),
        createdAt: toEpochMs(data.createdAt),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function createCategory(name: string): Promise<Category> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Category name cannot be empty.");

  const id = slugify(trimmed);
  if (!id) throw new Error("Category name must contain at least one letter or number.");

  const categoryRef = doc(db, "categories", id);
  const existing = await getDoc(categoryRef);
  if (existing.exists()) {
    throw new Error(`A category named "${trimmed}" already exists.`);
  }

  await setDoc(categoryRef, { name: trimmed, createdAt: serverTimestamp() });
  return { id, name: trimmed, createdAt: Date.now() };
}

function mapSongDoc(id: string, data: Record<string, unknown>): Song {
  return {
    id,
    title: String(data.title ?? "Untitled"),
    artist: typeof data.artist === "string" ? data.artist : null,
    categoryId: String(data.categoryId ?? ""),
    categoryName: String(data.categoryName ?? ""),
    audioPath: String(data.audioPath ?? ""),
    thumbnailPath: typeof data.thumbnailPath === "string" ? data.thumbnailPath : null,
    duration: typeof data.duration === "number" ? data.duration : null,
    createdAt: toEpochMs(data.createdAt),
    createdBy: String(data.createdBy ?? ""),
  };
}

export async function fetchSongsByCategory(categoryId: string): Promise<Song[]> {
  const snapshot = await getDocs(
    query(collection(db, "songs"), where("categoryId", "==", categoryId))
  );
  return snapshot.docs.map((docSnap) => mapSongDoc(docSnap.id, docSnap.data()));
}

export async function fetchAllSongsOnce(): Promise<Song[]> {
  const snapshot = await getDocs(collection(db, "songs"));
  return snapshot.docs.map((docSnap) => mapSongDoc(docSnap.id, docSnap.data()));
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
  return onSnapshot(q, (snapshot) => {
    for (const change of snapshot.docChanges()) {
      if (change.type === "added") {
        onNewSong(mapSongDoc(change.doc.id, change.doc.data()));
      }
    }
  });
}

/**
 * Resolves a song's `audioPath` to a playable data: URI. Fetches the
 * base64 payload from Realtime Database lazily — only when a song is
 * actually about to play, not when listing/browsing songs.
 */
export async function fetchSongAudio(audioPath: string): Promise<string> {
  const snapshot = await get(dbRef(rtdb, audioPath));
  const value = snapshot.val() as { data?: string; contentType?: string } | null;
  if (!value?.data) throw new Error("This song's audio file is missing.");
  return `data:${value.contentType || "audio/mpeg"};base64,${value.data}`;
}

/** Resolves a song's `thumbnailPath` to a displayable data: URI. */
export async function fetchSongThumbnail(thumbnailPath: string): Promise<string | null> {
  const snapshot = await get(dbRef(rtdb, thumbnailPath));
  const value = snapshot.val() as { data?: string; contentType?: string } | null;
  if (!value?.data) return null;
  return `data:${value.contentType || "image/jpeg"};base64,${value.data}`;
}

/** Reads an audio file's duration in seconds by loading it into a throwaway <audio> element. */
function readAudioDuration(file: File): Promise<number | null> {
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
  categoryId: string;
  categoryName: string;
  onProgress?: (pct: number) => void;
}

export async function uploadSong({
  file,
  title,
  artist,
  categoryId,
  categoryName,
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
  if (!categoryId) throw new Error("A category must be selected.");

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

  await dbSet(dbRef(rtdb, audioPath), { data: base64Data, contentType: file.type });
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
      categoryId,
      categoryName,
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
