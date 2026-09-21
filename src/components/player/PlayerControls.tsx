"use client";

import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { useRadio } from "@/hooks/useRadio";

export default function PlayerControls() {
  const { isPlaying, isLoading, currentSong, togglePlay, next, previous } = useRadio();

  const disabled = !currentSong;

  return (
    <div className="flex items-center gap-3 sm:gap-4">
      <button
        type="button"
        onClick={previous}
        disabled={disabled}
        aria-label="Previous song"
        className="flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <SkipBack size={16} fill="currentColor" />
      </button>

      <button
        type="button"
        onClick={togglePlay}
        disabled={disabled}
        aria-label={isPlaying ? "Pause" : "Play"}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-background shadow-lg shadow-black/30 transition hover:bg-accent-dark active:scale-95 disabled:opacity-40"
      >
        {isLoading ? (
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : isPlaying ? (
          <Pause size={24} fill="currentColor" />
        ) : (
          <Play size={24} fill="currentColor" className="ml-0.5" />
        )}
      </button>

      <button
        type="button"
        onClick={next}
        disabled={disabled}
        aria-label="Next song"
        className="flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <SkipForward size={16} fill="currentColor" />
      </button>
    </div>
  );
}
