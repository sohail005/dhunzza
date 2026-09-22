"use client";

import { motion, useReducedMotion } from "motion/react";
import type { CommunityRequestEvent } from "@/types/communityFeed";
import { formatShortTime } from "@/lib/time";

// Cycled by a hash of the requester's name so the same name always gets the
// same color for the length of a page visit, and different requesters are
// visually distinguishable at a glance — matching the reference chat's
// per-sender name coloring.
const NAME_COLORS = [
  "text-accent",
  "text-pink-400",
  "text-purple-400",
  "text-teal-400",
  "text-sky-400",
  "text-emerald-400",
];

function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return NAME_COLORS[Math.abs(hash) % NAME_COLORS.length];
}

export default function CommunityFeedMessage({ event }: { event: CommunityRequestEvent }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex justify-start"
    >
      <div className="liquid-glass max-w-[85%] rounded-2xl rounded-bl-sm px-4 py-2.5">
        <p className={`text-xs font-semibold ${colorForName(event.requesterName)}`}>
          {event.requesterName}
        </p>
        <p className="text-sm leading-relaxed wrap-break-word text-white/90">
          🎵 requested <span className="font-medium text-white">{event.songName}</span>
        </p>
        <p className="mt-1 text-right text-[10px] text-white/40">{formatShortTime(event.createdAt)}</p>
      </div>
    </motion.div>
  );
}
