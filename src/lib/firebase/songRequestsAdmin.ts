"use client";

import {
  get,
  limitToLast,
  onValue,
  orderByChild,
  query,
  ref as dbRef,
  runTransaction,
  serverTimestamp,
  update as dbUpdate,
} from "firebase/database";
import { auth, rtdb } from "@/lib/firebase/config";
import { appendSongAddedMessage } from "@/lib/firebase/chatSessions";
import type { SongRequest, SongRequestStatus } from "@/types/songRequest";

const REQUESTS_PATH = "songRequests";
// Only the two active states are ever surfaced in the admin queue — fulfilled
// ("added") requests are filtered out client-side (there's no server-side
// composite index on status+createdAt), and there's deliberately no
// "rejected"/"approved" affordance in this UI.
const ACTIVE_STATUSES = new Set<SongRequestStatus>(["pending", "reviewing"]);
// A "reviewing" claim older than this is treated as abandoned (e.g. the
// admin's tab crashed mid-upload) and can be released/retried by any admin.
export const CLAIM_STALE_MS = 10 * 60 * 1000;
// Bounds how much of the list is pulled over the wire — this is an admin
// operational queue, not a historical archive.
const FETCH_LIMIT = 300;

export interface AdminSongRequest extends SongRequest {
  id: string;
}

export type ClaimResult =
  | { ok: true }
  | { ok: false; reason: "not-found" | "already-claimed" };

function currentAdminEmail(): string {
  const email = auth.currentUser?.email;
  if (!email) throw new Error("You must be signed in as an admin.");
  return email;
}

/**
 * Live-subscribes to the active (pending/reviewing) song request queue,
 * newest first. Returns an unsubscribe function — callers must invoke it on
 * unmount to avoid leaking the listener.
 */
export function subscribeToSongRequests(
  onData: (requests: AdminSongRequest[]) => void,
  onError: (error: unknown) => void
): () => void {
  const q = query(dbRef(rtdb, REQUESTS_PATH), orderByChild("createdAt"), limitToLast(FETCH_LIMIT));
  return onValue(
    q,
    (snapshot) => {
      const items: AdminSongRequest[] = [];
      snapshot.forEach((child) => {
        const value = child.val() as SongRequest | null;
        if (!value || !ACTIVE_STATUSES.has(value.status)) return;
        items.push({ ...value, id: child.key as string });
      });
      items.sort((a, b) => b.createdAt - a.createdAt);
      onData(items);
    },
    onError
  );
}

/**
 * Atomically claims a pending request for the signed-in admin so two admins
 * can't fulfill the same request concurrently. Uses a Realtime Database
 * transaction on the single request node — the transaction's update
 * function only ever runs against the latest server value, so a concurrent
 * claim always loses.
 */
export async function claimSongRequest(requestId: string): Promise<ClaimResult> {
  const email = currentAdminEmail();
  const nodeRef = dbRef(rtdb, `${REQUESTS_PATH}/${requestId}`);

  const result = await runTransaction(nodeRef, (current: SongRequest | null) => {
    if (!current) return current; // abort: node doesn't exist
    if (current.status !== "pending") return; // abort: already claimed/fulfilled
    return { ...current, status: "reviewing", reviewedBy: email, reviewedAt: Date.now() };
  });

  if (!result.committed || !result.snapshot.exists()) return { ok: false, reason: "not-found" };

  const value = result.snapshot.val() as SongRequest;
  if (value.status !== "reviewing" || value.reviewedBy !== email) {
    return { ok: false, reason: "already-claimed" };
  }
  return { ok: true };
}

/**
 * Releases a "reviewing" claim back to "pending" — used when an admin
 * cancels the Add Song dialog, or to recover a stale/abandoned claim (see
 * CLAIM_STALE_MS). Any admin may release a stale claim; only the owning
 * admin may release a fresh one.
 */
export async function releaseSongRequestClaim(requestId: string): Promise<void> {
  const email = currentAdminEmail();
  const nodeRef = dbRef(rtdb, `${REQUESTS_PATH}/${requestId}`);

  await runTransaction(nodeRef, (current: SongRequest | null) => {
    if (!current || current.status !== "reviewing") return current;
    const isOwner = current.reviewedBy === email;
    const isStale = typeof current.reviewedAt === "number" && Date.now() - current.reviewedAt > CLAIM_STALE_MS;
    if (!isOwner && !isStale) return; // abort: not ours and not abandoned
    return { ...current, status: "pending", reviewedBy: null, reviewedAt: null };
  });
}

interface FulfillInput {
  requestId: string;
  songId: string;
  songTitle: string;
}

/**
 * Completes fulfillment of a claimed request: re-reads the request from the
 * server (never trusts in-memory client state), verifies this admin still
 * owns the claim, marks it "added", and — best-effort — notifies the
 * requester's saved chat session. Idempotent: if the request was already
 * fulfilled (e.g. a retried call), it's treated as a safe no-op rather than
 * creating a duplicate notification.
 */
export async function fulfillSongRequest({ requestId, songId, songTitle }: FulfillInput): Promise<void> {
  const email = currentAdminEmail();
  const nodeRef = dbRef(rtdb, `${REQUESTS_PATH}/${requestId}`);

  const snapshot = await get(nodeRef);
  if (!snapshot.exists()) return; // request already fully cleaned up — nothing to do

  const current = snapshot.val() as SongRequest;
  if (current.status === "added") return; // already fulfilled — idempotent no-op
  if (current.status !== "reviewing" || current.reviewedBy !== email) {
    throw new Error("This request is no longer claimed by you — it may have been released or reassigned.");
  }

  await dbUpdate(nodeRef, {
    status: "added",
    songId,
    reviewedAt: serverTimestamp(),
    reviewedBy: email,
  });

  const sessionId = current.sessionId;
  if (sessionId) {
    await appendSongAddedMessage(sessionId, songTitle, songId).catch(() => {
      // Best-effort — the request is still correctly marked "added" above
      // even if the chat notification couldn't be delivered.
    });
  }
}
