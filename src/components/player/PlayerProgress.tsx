"use client";

import { useRadio } from "@/hooks/useRadio";
import { formatDuration } from "@/lib/time";

export default function PlayerProgress() {
  const { currentTime, duration, seek, currentSong } = useRadio();

  const pct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const value = Number(e.target.value);
    seek((value / 100) * duration);
  }

  return (
    <div className="flex w-full items-center gap-2 text-[14px] text-white/60">
      <span className="w-9 shrink-0 text-right tabular-nums">{formatDuration(currentTime)}</span>
      <input
        type="range"
        min={0}
        max={100}
        step={0.1}
        value={pct}
        onChange={handleSeek}
        disabled={!currentSong || duration === 0}
        aria-label="Seek"
        className="desi-progress h-2 w-full flex-1 cursor-pointer appearance-none rounded-full bg-white/20 accent-[var(--accent)] disabled:cursor-default"
        style={{
          background: `linear-gradient(to right, var(--accent) ${pct}%, rgba(255,255,255,0.2) ${pct}%)`,
        }}
      />
      <span className="w-9 shrink-0 tabular-nums">{formatDuration(duration)}</span>
    </div>
  );
}
