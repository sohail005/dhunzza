"use client";

import { Volume1, Volume2, VolumeX } from "lucide-react";
import { useRadio } from "@/hooks/useRadio";

export default function PlayerVolume() {
  const { volume, isMuted, setVolume, toggleMute } = useRadio();

  const Icon = isMuted || volume === 0 ? VolumeX : volume < 55 ? Volume1 : Volume2;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggleMute}
        aria-label={isMuted ? "Unmute" : "Mute"}
        className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
      >
        <Icon size={17} />
      </button>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={isMuted ? 0 : volume}
        onChange={(e) => setVolume(Number(e.target.value))}
        aria-label="Volume"
        className="h-1 w-14 cursor-pointer appearance-none rounded-full bg-white/20 accent-[var(--accent)] sm:w-20"
        style={{
          background: `linear-gradient(to right, var(--accent) ${isMuted ? 0 : volume}%, rgba(255,255,255,0.2) ${isMuted ? 0 : volume}%)`,
        }}
      />
    </div>
  );
}
