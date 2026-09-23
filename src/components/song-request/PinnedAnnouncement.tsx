"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Pin, X } from "lucide-react";
import { colorForName } from "@/lib/nameColor";

const ANNOUNCEMENT_ID = "support-qr-2026";
const ADMIN_NAME = "Dhunzza Admin";
const MESSAGE = "Please support on QR to keep this platform smooth and Ad Free Forever. THANK YOU";

const DISMISSED_KEY = `dhunzza:pinned:${ANNOUNCEMENT_ID}:dismissed`;

export default function PinnedAnnouncement() {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISSED_KEY) === "1");
  }, []);

  if (dismissed) return null;

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  }

  return (
    <div className="liquid-glass mx-4 mt-3 flex shrink-0 items-start gap-2.5 rounded-2xl px-3.5 py-2.5">
      <Pin size={14} className="mt-0.5 shrink-0 -rotate-45 text-white/50" aria-hidden />
      <p className="min-w-0 flex-1 text-sm leading-relaxed text-white/80">
        <span className={`inline-flex items-center gap-1 font-semibold ${colorForName(ADMIN_NAME)}`}>
          {ADMIN_NAME}
          <BadgeCheck size={13} className="shrink-0 fill-sky-400 text-background" aria-label="Verified admin" />
        </span>
        {": "}
        {MESSAGE}
        <span aria-hidden> ❤️</span>
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss pinned message"
        className="shrink-0 text-white/40 transition hover:text-white/70"
      >
      </button>
    </div>
  );
}
