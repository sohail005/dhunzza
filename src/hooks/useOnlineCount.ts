"use client";

import { useEffect, useState } from "react";

const SESSION_KEY = "dhunzza.session-id";
const HEARTBEAT_INTERVAL_MS = 15_000;

function getSessionId(): string {
  let id = window.sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

/**
 * Live count of active browser sessions, tracked via a periodic heartbeat
 * to /api/presence. Counts are only shared across requests handled by the
 * same server instance.
 */
export function useOnlineCount(): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const sessionId = getSessionId();
    let cancelled = false;

    async function heartbeat() {
      try {
        const res = await fetch("/api/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const data = await res.json();
        if (!cancelled && typeof data.count === "number") setCount(data.count);
      } catch {
        // transient network error — keep showing the last known count
      }
    }

    heartbeat();
    const interval = window.setInterval(heartbeat, HEARTBEAT_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  return count;
}
