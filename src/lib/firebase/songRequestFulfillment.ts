"use client";

import { equalTo, get, orderByChild, query, ref as dbRef, serverTimestamp, update as dbUpdate } from "firebase/database";
import { getFirebaseAuth, rtdb } from "@/lib/firebase/config";

const auth = getFirebaseAuth();
import { normalizeSongName } from "@/lib/validation/songRequest";
import { appendSongAddedMessage } from "@/lib/firebase/chatSessions";

const REQUESTS_PATH = "songRequests";

/**
 * Called after an admin upload succeeds (see UploadForm.tsx) to close the
 * loop on any pending chatbot request for the same song: marks matching
 * requests "added" and, where the requester's chat session is still known,
 * appends a "your song is here!" message with a Play button directly into
 * their saved conversation (see appendSongAddedMessage).
 *
 * Runs on the client using the signed-in admin's own auth — songRequests
 * writes require the `admin` custom claim (see database.rules.json), same
 * as the rest of the admin dashboard's Firebase access.
 */
export async function fulfillMatchingSongRequests(songTitle: string, songId: string): Promise<number> {
  const currentUser = auth.currentUser;
  if (!currentUser?.email) return 0;

  const normalized = normalizeSongName(songTitle);
  if (!normalized) return 0;

  let snapshot;
  try {
    snapshot = await get(
      query(dbRef(rtdb, REQUESTS_PATH), orderByChild("normalizedSongName"), equalTo(normalized))
    );
  } catch (error) {
    // Matching pending requests is a nice-to-have follow-up to the upload,
    // not something that should make the upload itself look like it failed.
    console.error("song-request fulfillment lookup failed:", error);
    return 0;
  }
  if (!snapshot.exists()) return 0;

  const updates: Record<string, unknown> = {};
  const sessionIds: string[] = [];
  let matchCount = 0;

  snapshot.forEach((child) => {
    if (child.child("status").val() !== "pending") return;
    updates[`${child.key}/status`] = "added";
    updates[`${child.key}/songId`] = songId;
    updates[`${child.key}/reviewedAt`] = serverTimestamp();
    updates[`${child.key}/reviewedBy`] = currentUser.email;
    matchCount++;

    const sessionId = child.child("sessionId").val();
    if (typeof sessionId === "string" && sessionId) sessionIds.push(sessionId);
  });

  if (matchCount === 0) return 0;

  await dbUpdate(dbRef(rtdb), updates);

  await Promise.all(
    sessionIds.map((sessionId) =>
      appendSongAddedMessage(sessionId, songTitle, songId).catch(() => {
        // Best-effort — the request is still correctly marked "added" above
        // even if the chat notification couldn't be delivered (e.g. the
        // requester's session already expired).
      })
    )
  );

  return matchCount;
}
