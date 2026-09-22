"use client";

import { useEffect, useState } from "react";
import { Loader2, Shuffle } from "lucide-react";
import { useRadio } from "@/hooks/useRadio";
import { fetchAllSongsOnce } from "@/lib/firebase/songs";

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function PlaylistSelector({ className = "" }: { className?: string }) {
  const { playQueue } = useRadio();
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!statusMessage) return;
    const timeout = window.setTimeout(() => setStatusMessage(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [statusMessage]);

  async function handleShuffleAll() {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const songs = await fetchAllSongsOnce();
      if (songs.length === 0) {
        setStatusMessage("No songs uploaded yet.");
        return;
      }
      playQueue(shuffle(songs), null);
    } catch {
      setStatusMessage("Couldn't load songs — check your connection.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={handleShuffleAll}
        disabled={isLoading}
        className="liquid-glass flex w-full items-center gap-1 rounded-full px-2 py-1.5 text-[11px] font-semibold whitespace-nowrap text-white disabled:opacity-60 sm:gap-1.5 sm:px-3 sm:text-[14px]"
      >
        {isLoading ? (
          <Loader2 size={12} className="shrink-0 animate-spin text-white/80 sm:h-3.5 sm:w-3.5" aria-hidden="true" />
        ) : (
          <Shuffle size={12} className="shrink-0 text-white/80 sm:h-3.5 sm:w-3.5" aria-hidden="true" />
        )}
        All Songs
      </button>

      {statusMessage && (
        <p className="liquid-glass absolute bottom-full left-1/2 z-40 mb-2 w-max max-w-56 -translate-x-1/2 rounded-xl px-3 py-2 text-center text-xs text-white/90">
          {statusMessage}
        </p>
      )}
    </div>
  );
}
