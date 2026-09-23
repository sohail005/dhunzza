import "server-only";

import { ServerValue } from "firebase-admin/database";
import { getAdminDatabase } from "@/lib/firebase/admin";
import { normalizeSongName, songRequestSchema } from "@/lib/validation/songRequest";
import type { SongRequest, SongRequestInput, SongRequestResult } from "@/types/songRequest";

const REQUESTS_PATH = "songRequests";
// Public, read-open projection of completed requests only (songName +
// requesterName + createdAt — nothing else) — streamed live into every
// visitor's chat via src/lib/firebase/communityFeed.ts. Never written from
// an in-progress draft, only once a submission actually succeeds.
const PUBLIC_FEED_PATH = "publicRequestFeed";
// Same normalized song requested again inside this window is treated as a
// duplicate — long enough to blunt double-taps/copy-paste spam, short
// enough that a popular song can legitimately be requested again later.
const DUPLICATE_WINDOW_MS = 60 * 60 * 1000;
// Requests are ephemeral — a week gives admins time to review before they're
// swept, without indefinitely retaining requester names. There's no Cloud
// Functions/cron infra in this project, so expiry is opportunistic: a
// fraction of submissions triggers a sweep instead of a scheduled job.
const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const CLEANUP_CHANCE = 0.2;
// The public feed entry and its songRequests record are written
// milliseconds apart in the same call below — generous enough to match
// reliably, tight enough not to catch an unrelated request for the same
// song name submitted around the same time.
const FEED_MATCH_WINDOW_MS = 60 * 1000;

/**
 * Server-only write path for the chatbot's song requests. Always goes
 * through the Admin SDK (never the client SDK) so createdAt/status/source
 * are set here, not trusted from the request body — see
 * src/app/api/song-request/route.ts for the caller and the rate limiting
 * that happens before this is invoked.
 */
export async function createSongRequest(input: SongRequestInput): Promise<SongRequestResult> {
  const parsed = songRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const { songName, requesterName } = parsed.data;
  const normalizedSongName = normalizeSongName(songName);
  const db = getAdminDatabase();

  const isDuplicate = await hasRecentDuplicate(normalizedSongName);

  const record: Omit<SongRequest, "createdAt"> & { createdAt: object } = {
    songName,
    requesterName,
    normalizedSongName,
    createdAt: ServerValue.TIMESTAMP,
    status: "pending",
    source: "chatbot",
    userId: null,
    sessionId: input.sessionId ?? null,
    songId: null,
  };

  const ref = await db.ref(REQUESTS_PATH).push(record);
  if (!ref.key) {
    return { ok: false, error: "Failed to create request." };
  }

  // Best-effort — the request itself is already saved above; a failure to
  // broadcast it live shouldn't surface as a submission error. requestId is
  // stored so an admin deleting the request later (see
  // deleteSongRequestWithSideEffects) can find and remove this exact entry
  // instead of guessing by name/time — it's never read by the public feed
  // UI (see communityFeed.ts, which only ever destructures the three public
  // fields).
  db.ref(PUBLIC_FEED_PATH)
    .push({ songName, requesterName, createdAt: ServerValue.TIMESTAMP, requestId: ref.key })
    .catch((error) => console.error("public request feed write failed:", error));

  if (Math.random() < CLEANUP_CHANCE) {
    // Best-effort, awaited but never allowed to fail the submission — see
    // deleteExpiredSongRequests() / deleteExpiredPublicFeed().
    await Promise.all([deleteExpiredSongRequests(), deleteExpiredPublicFeed()]);
  }

  return { ok: true, requestId: ref.key, duplicate: isDuplicate };
}

/**
 * Deletes a request (admin action — spam, duplicate, or one that won't be
 * fulfilled) along with its side effects: the requester's saved chat
 * session, and its broadcast entry in the public feed. Must go through the
 * Admin SDK — database.rules.json hard-blocks client writes to
 * publicRequestFeed (`.write: false`) regardless of the admin custom claim,
 * so the admin panel's own client-side RTDB calls can never reach it.
 */
export async function deleteSongRequestWithSideEffects(requestId: string): Promise<void> {
  const db = getAdminDatabase();
  const requestRef = db.ref(`${REQUESTS_PATH}/${requestId}`);

  const snapshot = await requestRef.get();
  if (!snapshot.exists()) return; // already gone — nothing to do

  const request = snapshot.val() as SongRequest;
  await requestRef.remove();

  if (request.sessionId) {
    await db
      .ref(`chatSessions/${request.sessionId}`)
      .remove()
      .catch((error) => console.error("chat session cleanup failed:", error));
  }

  await deleteMatchingPublicFeedEvents(requestId, request).catch((error) =>
    console.error("public request feed cleanup failed:", error)
  );
}

/** Finds the publicRequestFeed entry this request produced and removes it —
 * exact match on requestId for entries written after that field existed,
 * falling back to a name + time-window match for older entries. */
async function deleteMatchingPublicFeedEvents(requestId: string, request: SongRequest): Promise<void> {
  const db = getAdminDatabase();
  const snapshot = await db
    .ref(PUBLIC_FEED_PATH)
    .orderByChild("createdAt")
    .startAt(request.createdAt - FEED_MATCH_WINDOW_MS)
    .endAt(request.createdAt + FEED_MATCH_WINDOW_MS)
    .get();
  if (!snapshot.exists()) return;

  const updates: Record<string, null> = {};
  snapshot.forEach((child) => {
    const value = child.val() as { songName?: unknown; requesterName?: unknown; requestId?: unknown };
    const isMatch =
      value.requestId === requestId ||
      (value.requestId === undefined &&
        value.songName === request.songName &&
        value.requesterName === request.requesterName);
    if (isMatch && child.key) updates[child.key] = null;
  });

  const keys = Object.keys(updates);
  if (keys.length > 0) await db.ref(PUBLIC_FEED_PATH).update(updates);
}

/**
 * Sweeps song requests older than EXPIRY_MS. Triggered probabilistically
 * from createSongRequest rather than on a schedule — this project has no
 * Cloud Functions/cron runtime, and running it on every write would add
 * needless latency to every submission for a cleanup that doesn't need to
 * be immediate.
 */
export async function deleteExpiredSongRequests(): Promise<number> {
  const db = getAdminDatabase();
  const cutoff = Date.now() - EXPIRY_MS;

  try {
    const snapshot = await db.ref(REQUESTS_PATH).orderByChild("createdAt").endAt(cutoff).get();
    if (!snapshot.exists()) return 0;

    const updates: Record<string, null> = {};
    snapshot.forEach((child) => {
      if (child.key) updates[child.key] = null;
    });

    const keys = Object.keys(updates);
    if (keys.length === 0) return 0;

    await db.ref(REQUESTS_PATH).update(updates);
    return keys.length;
  } catch (error) {
    console.error("song-request expiry cleanup failed:", error);
    return 0;
  }
}

/** Sibling sweep to deleteExpiredSongRequests(), same retention window, for
 * the public feed projection. */
export async function deleteExpiredPublicFeed(): Promise<number> {
  const db = getAdminDatabase();
  const cutoff = Date.now() - EXPIRY_MS;

  try {
    const snapshot = await db.ref(PUBLIC_FEED_PATH).orderByChild("createdAt").endAt(cutoff).get();
    if (!snapshot.exists()) return 0;

    const updates: Record<string, null> = {};
    snapshot.forEach((child) => {
      if (child.key) updates[child.key] = null;
    });

    const keys = Object.keys(updates);
    if (keys.length === 0) return 0;

    await db.ref(PUBLIC_FEED_PATH).update(updates);
    return keys.length;
  } catch (error) {
    console.error("public request feed expiry cleanup failed:", error);
    return 0;
  }
}

async function hasRecentDuplicate(normalizedSongName: string): Promise<boolean> {
  const db = getAdminDatabase();
  const cutoff = Date.now() - DUPLICATE_WINDOW_MS;

  try {
    const snapshot = await db
      .ref(REQUESTS_PATH)
      .orderByChild("normalizedSongName")
      .equalTo(normalizedSongName)
      .limitToLast(5)
      .get();

    if (!snapshot.exists()) return false;

    let found = false;
    snapshot.forEach((child) => {
      const createdAt = child.child("createdAt").val();
      if (typeof createdAt === "number" && createdAt >= cutoff) found = true;
    });
    return found;
  } catch (error) {
    // Duplicate detection is a nice-to-have, not a submission gate — if the
    // `.indexOn` rule for normalizedSongName isn't deployed yet (or the
    // query otherwise fails), degrade to "not a duplicate" instead of
    // blocking the whole request.
    console.error("song-request duplicate check failed:", error);
    return false;
  }
}
