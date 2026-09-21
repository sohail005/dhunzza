"use client";

import { useState } from "react";
import { Radio, Share2 } from "lucide-react";
import { useRadio } from "@/hooks/useRadio";
import PlayerControls from "@/components/player/PlayerControls";
import PlayerProgress from "@/components/player/PlayerProgress";
import PlayerVolume from "@/components/player/PlayerVolume";
import RainEffect from "@/components/RainEffect";
import PlaylistSelector from "@/components/PlaylistSelector";
import CategorySelector from "@/components/CategorySelector";

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
  const { currentSong, isPlaying, hasTunedIn, isLoading, playbackUnavailable, tuneIn } =
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
      <div className="absolute inset-x-3 top-[76%] z-40 -translate-y-1/2 sm:inset-x-6">
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
      className="absolute inset-x-3 top-[68%] z-40 -translate-y-1/2 sm:inset-x-6"
    >
      <div className="relative mx-auto flex w-full max-w-2xl flex-wrap items-center justify-center gap-1.5 sm:gap-2">
        <CategorySelector className="w-auto shrink-0" />
        <PlaylistSelector className="w-auto shrink-0" />
        <RainEffect />
        <button
          type="button"
          onClick={handleShare}
          className="liquid-glass flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] whitespace-nowrap text-white/95 sm:gap-2 sm:px-4 sm:text-[16px]"
        >
          <Share2 size={13} />
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
            {currentSong ? (
              <>
                <p className="truncate text-[18px] font-semibold text-white sm:text-[20px]">
                  {currentSong.title}
                </p>
                <p className="truncate text-[16px] text-white/50">
                  {isLoading
                    ? "Tuning in…"
                    : currentSong.artist
                      ? `Credits: ${currentSong.artist}`
                      : currentSong.categoryName}
                </p>
              </>
            ) : (
              <p className="text-[18px] text-white/60">Nothing tuned in yet</p>
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
        <p className="mx-auto mt-2 max-w-2xl text-center text-[16px] text-amber-400">
          Couldn&apos;t load a track right now — check your connection and try again.
        </p>
      )}
    </div>
  );
}
