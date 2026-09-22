"use client";

import { useState } from "react";
import { Radio, Share2 } from "lucide-react";
import { useRadio } from "@/hooks/useRadio";
import PlayerControls from "@/components/player/PlayerControls";
import PlayerProgress from "@/components/player/PlayerProgress";
import PlayerVolume from "@/components/player/PlayerVolume";
import MarqueeText from "@/components/player/MarqueeText";
import RainEffect from "@/components/RainEffect";
import PlaylistSelector from "@/components/PlaylistSelector";
import EraSelector from "@/components/EraSelector";
import { ERA_BY_ID } from "@/lib/eras";

function copyToClipboard(text: string): boolean {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => {
      fallbackCopy(text);
    });
    return true;
  }
  return fallbackCopy(text);
}

function fallbackCopy(text: string): boolean {
  if (typeof document === "undefined") return false;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  let succeeded = false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- last-resort fallback when Clipboard API is unavailable
    succeeded = document.execCommand("copy");
  } catch {
    succeeded = false;
  }
  document.body.removeChild(textarea);
  return succeeded;
}

export default function RadioPlayer() {
  const { currentSong, currentEra, isPlaying, hasTunedIn, isLoading, playbackUnavailable, tuneIn } =
    useRadio();
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  async function handleShare() {
    const shareData = {
      title: "Dhunzza",
      text: "Dhunzza — old Hindi songs, playing all day.",
      url: typeof window !== "undefined" ? window.location.origin : undefined,
    };

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        // Some browsers report share as supported but throw — fall through to copy.
      }
    }

    if (shareData.url && copyToClipboard(shareData.url)) {
      setShareMessage("Link copied!");
    } else {
      setShareMessage("Couldn't share — copy the URL manually.");
    }
    window.setTimeout(() => setShareMessage(null), 2000);
  }

  if (!hasTunedIn && !currentSong) {
    return (
      <div className="absolute inset-x-3 bottom-6 z-40 sm:inset-x-6 sm:top-[76%] sm:bottom-auto sm:-translate-y-1/2">
        <button
          type="button"
          onClick={tuneIn}
          className="liquid-glass-card mx-auto flex w-full max-w-2xl items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[16px] font-semibold text-white shadow-lg transition"
        >
          <Radio size={16} className="text-accent" />
          Tap to Tune In
        </button>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Now playing"
      className="absolute inset-x-3 bottom-6 z-40 sm:inset-x-6 sm:top-[68%] sm:bottom-auto sm:-translate-y-1/2"
    >
      <div className="relative mx-auto flex w-full max-w-2xl flex-nowrap items-center justify-center gap-1 sm:flex-wrap sm:gap-2">
        <EraSelector className="w-auto shrink" />
        <PlaylistSelector className="w-auto shrink" />
        <RainEffect />
        <button
          type="button"
          onClick={handleShare}
          className="liquid-glass flex shrink-0 items-center gap-1 rounded-full px-2 py-1.5 text-[11px] whitespace-nowrap text-white/95 sm:gap-2 sm:px-4 sm:text-[16px]"
        >
          <Share2 size={12} className="shrink-0 sm:hidden" />
          <Share2 size={13} className="hidden shrink-0 sm:block" />
          Share
        </button>

        {shareMessage && (
          <p className="liquid-glass absolute bottom-full left-1/2 mb-2 -translate-x-1/2 rounded-full px-3 py-1.5 text-[14px] whitespace-nowrap text-white/90 sm:text-[16px]">
            {shareMessage}
          </p>
        )}
      </div>

      <div className="liquid-glass-card mx-auto mt-2 flex max-w-2xl flex-col gap-2 rounded-2xl px-4 py-2.5 shadow-lg sm:px-5 sm:py-3">
        <div className="flex items-center gap-3 sm:gap-4">
          <span
            className={`relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-white/15 sm:h-12 sm:w-12 ${
              isPlaying ? "animate-spin-slow" : ""
            }`}
            aria-hidden="true"
          >
            <span className="liquid-glass flex h-full w-full items-center justify-center text-accent">
              <Radio size={16} />
            </span>
          </span>

          <div className="min-w-0 flex-1">
            {currentEra && (
              <p className="text-[9px] font-semibold tracking-[0.2em] text-accent sm:text-[11px]">
                You are in · {ERA_BY_ID[currentEra].label}
              </p>
            )}
            {currentSong ? (
              <>
                <MarqueeText
                  text={currentSong.title}
                  className="text-[14px] font-semibold text-white sm:text-[20px]"
                />
                <p className="truncate text-[12px] text-white/50 sm:text-[16px]">
                  {isLoading ? "Tuning in…" : currentSong.artist || "Dhunzza"}
                </p>
              </>
            ) : (
              <p className="text-[14px] text-white/60 sm:text-[18px]">Nothing tuned in yet</p>
            )}
          </div>

          <PlayerControls />

          <div className="hidden sm:block">
            <PlayerVolume />
          </div>
        </div>

        {currentSong && <PlayerProgress />}
      </div>

      {playbackUnavailable && (
        <p className="mx-auto mt-2 max-w-2xl text-center text-[13px] text-amber-400 sm:text-[16px]">
          Couldn&apos;t load a track right now — check your connection and try again.
        </p>
      )}
    </div>
  );
}
