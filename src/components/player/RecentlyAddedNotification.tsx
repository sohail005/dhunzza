"use client";

import { useEffect, useState } from "react";
import { Play, Sparkles, X } from "lucide-react";
import { useRadio } from "@/hooks/useRadio";
import type { Song } from "@/types/music";
import SongThumbnail from "@/components/SongThumbnail";

const TRANSITION_MS = 300;

/**
 * Sticky toast for songs uploaded while the user is browsing. Only one
 * notification is ever shown — it always reflects the newest arrival, with
 * a "+N more" badge for anything queued behind it that expands into the
 * full list. Playing or dismissing only clears the toast; the songs
 * themselves stay in `recentlyAdded` and in the Firestore-backed library,
 * so nothing is lost.
 *
 * Animates in/out (fade + slide + scale) instead of snapping, and pops the
 * inner content whenever the displayed song changes underneath it — keyed
 * on the song id so React remounts (and re-triggers the CSS animation on)
 * just that row rather than the whole card.
 */
export default function RecentlyAddedNotification() {
  const { newSongNotification, playRecentlyAddedSong, dismissNewSongNotification } = useRadio();
  const [isListOpen, setIsListOpen] = useState(false);

  const shouldShow = newSongNotification.length > 0;
  const [shouldRender, setShouldRender] = useState(shouldShow);
  const [isEntered, setIsEntered] = useState(false);
  // Snapshot of the last non-empty list — keeps the card's content visible
  // while it plays its exit transition instead of going blank the instant
  // the real list empties out. Adjusted during render (React's sanctioned
  // pattern for deriving state from a prop change) rather than in an effect.
  const [snapshot, setSnapshot] = useState(newSongNotification);
  const [prevNotification, setPrevNotification] = useState(newSongNotification);
  if (newSongNotification !== prevNotification) {
    setPrevNotification(newSongNotification);
    if (newSongNotification.length > 0) setSnapshot(newSongNotification);
  }

  useEffect(() => {
    let raf = 0;
    let timeout = 0;
    Promise.resolve().then(() => {
      if (shouldShow) {
        setShouldRender(true);
        raf = requestAnimationFrame(() => setIsEntered(true));
      } else {
        setIsEntered(false);
        timeout = window.setTimeout(() => setShouldRender(false), TRANSITION_MS);
      }
    });
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timeout);
    };
  }, [shouldShow]);

  if (!shouldRender) return null;

  const latest = snapshot[snapshot.length - 1];
  const extraCount = Math.max(snapshot.length - 1, 0);
  // Newest first for the expanded list.
  const allSongs = [...snapshot].reverse();

  // Playing the summary card's song dismisses the whole toast, per spec.
  // Playing a song from the expanded list only removes that one row — the
  // rest (and the toast itself) stay put so the user can keep picking.
  function handlePlayLatest(song: Song) {
    setIsListOpen(false);
    playRecentlyAddedSong(song);
    dismissNewSongNotification();
  }

  function handlePlayFromList(song: Song) {
    playRecentlyAddedSong(song);
  }

  function handleDismiss() {
    setIsListOpen(false);
    dismissNewSongNotification();
  }

  return (
    // No transform here — Tailwind's translate/scale utilities set a CSS
    // `transform` even at identity values, and any transform on an ancestor
    // creates a new containing block for `position: fixed` descendants
    // (the backdrop + bottom-sheet list below), pinning them to this box
    // instead of the real viewport. The animation lives on the toast card
    // itself instead.
    <div className="flex w-full max-w-sm flex-col gap-2">
      <div
        role="status"
        className={`liquid-glass-card flex items-center gap-2.5 overflow-hidden rounded-2xl bg-[rgba(15,8,6,0.94)] py-2 pr-2 pl-3 shadow-lg transition-all duration-300 ease-out ${
          isEntered ? "translate-y-0 scale-100 opacity-100" : "-translate-y-3 scale-90 opacity-0"
        }`}
      >
        <div key={latest?.id} className="animate-pop-in flex min-w-0 flex-1 items-center gap-2.5">
          <SongThumbnail thumbnailPath={latest?.thumbnailPath ?? null} className="h-10 w-10 rounded-xl" />

          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 text-[12px] font-semibold text-amber-400 uppercase tracking-wide">
              <Sparkles size={11} />
              Recently added
              {extraCount > 0 && (
                <button
                  type="button"
                  onClick={() => setIsListOpen((open) => !open)}
                  aria-expanded={isListOpen}
                  className="text-[12px] text-white/50 normal-case underline decoration-white/30 underline-offset-2 transition-colors hover:text-white"
                >
                  · +{extraCount} more
                </button>
              )}
            </p>
            <p className="truncate text-[14px] font-medium text-white">{latest?.title}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => latest && handlePlayLatest(latest)}
          aria-label={`Play ${latest?.title}`}
          className="liquid-glass flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white transition-transform active:scale-90"
        >
          <Play size={14} className="fill-current" />
        </button>

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/50 transition hover:text-white active:scale-90"
        >
          <X size={16} />
        </button>
      </div>

      {isListOpen && extraCount > 0 && (
        <>
          {/* Mobile only: dims the page and closes the list on outside tap.
              On sm+ the list is a small inline dropdown, no backdrop needed. */}
          <button
            type="button"
            onClick={() => setIsListOpen(false)}
            aria-label="Close list"
            className="fixed inset-0 z-40 animate-pop-in bg-black/60 sm:hidden"
          />
          <div
            className="liquid-glass-card animate-pop-in no-scrollbar fixed inset-x-3 bottom-4 z-50 max-h-[70vh] overflow-y-auto rounded-2xl bg-[rgba(15,8,6,0.94)] p-2 shadow-lg sm:static sm:inset-auto sm:z-auto sm:max-h-[min(60vh,26rem)]"
          >
            {allSongs.map((song) => (
              <div
                key={song.id}
                className="flex items-center gap-2.5 rounded-xl p-1.5 transition-colors hover:bg-white/5"
              >
                <SongThumbnail thumbnailPath={song.thumbnailPath} className="h-9 w-9 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-white">{song.title}</p>
                  {song.artist && <p className="truncate text-[11px] text-white/40">{song.artist}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => handlePlayFromList(song)}
                  aria-label={`Play ${song.title}`}
                  className="liquid-glass flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white transition-transform active:scale-90"
                >
                  <Play size={12} className="fill-current" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
