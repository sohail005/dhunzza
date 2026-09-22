"use client";

import { Music, User } from "lucide-react";

interface RequestPreviewProps {
  songName: string;
  requesterName: string;
}

export default function RequestPreview({ songName, requesterName }: RequestPreviewProps) {
  return (
    <div className="liquid-glass-card w-full rounded-2xl p-4 text-left">
      <div className="flex items-start gap-3">
        <span className="liquid-glass flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-accent">
          <Music size={16} />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] tracking-wide text-white/50 uppercase">Song</p>
          <p className="truncate text-sm font-semibold text-white">{songName}</p>
        </div>
      </div>
      <div className="mt-3 flex items-start gap-3">
        <span className="liquid-glass flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-accent">
          <User size={16} />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] tracking-wide text-white/50 uppercase">Requested by</p>
          <p className="truncate text-sm font-semibold text-white">{requesterName}</p>
        </div>
      </div>
    </div>
  );
}
