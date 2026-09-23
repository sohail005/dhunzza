"use client";

import { useEffect, useState } from "react";
import { subscribeToCommunityFeed } from "@/lib/firebase/communityFeed";

const LAST_SEEN_KEY = "dhunzza.live-chat.last-seen-at";

/**
 * Count of public live-chat activity (completed song requests, see
 * communityFeed.ts) that arrived since the chat was last opened on this
 * device — drives the notification badge on the header's "Live Chat"
 * button. Opening the chat (isOpen becomes true) marks everything seen.
 */
export function useLiveChatUnread(isOpen: boolean): number {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    return subscribeToCommunityFeed((events) => {
      const lastSeen = Number(localStorage.getItem(LAST_SEEN_KEY)) || 0;
      setUnreadCount(events.filter((event) => event.createdAt > lastSeen).length);
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    localStorage.setItem(LAST_SEEN_KEY, String(Date.now()));
    setUnreadCount(0);
  }, [isOpen]);

  return unreadCount;
}
