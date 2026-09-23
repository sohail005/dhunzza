"use client";

import { useEffect, useState } from "react";
import { Music } from "lucide-react";
import { getCachedSongThumbnail } from "@/lib/firebase/mediaCache";

interface SongThumbnailProps {
  thumbnailPath: string | null;
  className?: string;
  iconSize?: number;
}

export default function SongThumbnail({
  thumbnailPath,
  className = "h-9 w-9 rounded-lg",
  iconSize = 14,
}: SongThumbnailProps) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => (thumbnailPath ? getCachedSongThumbnail(thumbnailPath) : null))
      .then((dataUri) => {
        if (!cancelled) setSrc(dataUri);
      })
      .catch(() => {
        // Missing/invalid thumbnail (e.g. a legacy path) — fall back to the
        // default icon instead of leaving an unhandled rejection.
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [thumbnailPath]);

  if (!src) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center bg-white/10 text-white/40 ${className}`}
      >
        <Music size={iconSize} />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- data: URI, not an optimizable remote/static asset
    <img src={src} alt="" className={`shrink-0 object-cover ${className}`} />
  );
}
