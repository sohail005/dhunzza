"use client";

import { limitToLast, onValue, query, ref as dbRef } from "firebase/database";
import { rtdb } from "@/lib/firebase/config";
import type { CommunityRequestEvent } from "@/types/communityFeed";
import { debugLog } from "@/lib/firebase/debugLog";

const FEED_PATH = "publicRequestFeed";
// Enough to give new visitors a sense of recent activity without pulling
// the whole (already 7-day-capped) feed on every page load.
const FEED_LIMIT = 20;

function isValidEvent(key: string | null, value: unknown): value is Omit<CommunityRequestEvent, "id"> {
  if (!key || !value || typeof value !== "object") return false;
  const event = value as Record<string, unknown>;
  return (
    typeof event.songName === "string" &&
    typeof event.requesterName === "string" &&
    typeof event.createdAt === "number"
  );
}

/**
 * Live-subscribes to the public feed of completed song requests — every
 * visitor with the chat open sees the same stream in real time. Only
 * finished submissions are ever written here (see createSongRequest in
 * src/lib/firebase/songRequests.ts); in-progress drafts are never
 * broadcast. Returns an unsubscribe function.
 */
export function subscribeToCommunityFeed(onEvents: (events: CommunityRequestEvent[]) => void): () => void {
  const feedQuery = query(dbRef(rtdb, FEED_PATH), limitToLast(FEED_LIMIT));

  debugLog("communityFeed", "onValue: subscribing to public request feed");
  const unsubscribe = onValue(
    feedQuery,
    (snapshot) => {
      const events: CommunityRequestEvent[] = [];
      snapshot.forEach((child) => {
        if (isValidEvent(child.key, child.val())) {
          const value = child.val();
          events.push({
            id: child.key as string,
            songName: value.songName,
            requesterName: value.requesterName,
            createdAt: value.createdAt,
          });
        }
      });
      events.sort((a, b) => a.createdAt - b.createdAt);
      onEvents(events);
    },
    () => {
      // Permission denied (rules not deployed yet) or offline — the chat
      // still works fine without the live feed, so fail silently.
      onEvents([]);
    }
  );
  return () => {
    debugLog("communityFeed", "onValue: unsubscribing from public request feed");
    unsubscribe();
  };
}
