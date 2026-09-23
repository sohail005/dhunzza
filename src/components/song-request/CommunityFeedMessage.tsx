"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { CommunityRequestEvent } from "@/types/communityFeed";
import { formatShortTime } from "@/lib/time";
import { colorForName } from "@/lib/nameColor";

// Liking is a local, per-browser affordance (no backend field to persist it
// against — publicRequestFeed events are read-only past creation, see
// database.rules.json) — but it's keyed by event id so a like still survives
// reopening the chat within the same browser.
function likeKey(eventId: string): string {
  return `dhunzza:community-like:${eventId}`;
}

export default function CommunityFeedMessage({ event }: { event: CommunityRequestEvent }) {
  const reduceMotion = useReducedMotion();
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    setLiked(localStorage.getItem(likeKey(event.id)) === "1");
  }, [event.id]);

  function toggleLike() {
    const next = !liked;
    setLiked(next);
    localStorage.setItem(likeKey(event.id), next ? "1" : "0");
  }

  const likeCount = liked ? 1 : 0;

  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex justify-start"
    >
      <div className="liquid-glass flex max-w-[85%] items-start gap-2 rounded-2xl rounded-bl-sm px-4 py-2.5">
        <div className="min-w-0">
          <p className={`text-xs font-semibold ${colorForName(event.requesterName)}`}>
            {event.requesterName}
          </p>
          <p className="text-sm leading-relaxed wrap-break-word text-white/90">
            🎵 requested <span className="font-medium text-white">{event.songName}</span>
          </p>
          <p className="mt-1 text-right text-[10px] text-white/40">{formatShortTime(event.createdAt)}</p>
        </div>
        <button
          type="button"
          onClick={toggleLike}
          aria-pressed={liked}
          aria-label={liked ? "Unlike this message" : "Like this message"}
          className="mt-0.5 flex shrink-0 items-center gap-1 text-white/70 flex-row"
        >
          <Heart size={14} className={liked ? "fill-rose-500 text-rose-500" : ""} />
          <span className="text-[10px] tabular-nums leading-none text-white font-bold">{likeCount}</span>
        </button>
      </div>
    </motion.div>
  );
}
