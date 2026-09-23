"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ListMusic, Loader2, Play, Search, X } from "lucide-react";
import { useRadio } from "@/hooks/useRadio";
import { getSongsOnce } from "@/lib/firebase/songsCache";
import { isPlayableSong } from "@/lib/firebase/songs";
import type { Song } from "@/types/music";
import SongThumbnail from "@/components/SongThumbnail";

export default function AllSongsBrowser({ className = "" }: { className?: string }) {
  const { playQueue } = useRadio();
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [songs, setSongs] = useState<Song[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen || songs || isLoading) return;
    setIsLoading(true);
    setError(null);
    getSongsOnce()
      .then((result) =>
        setSongs(result.filter(isPlayableSong).sort((a, b) => a.title.localeCompare(b.title)))
      )
      .catch(() => setError("Couldn't load songs — check your connection."))
      .finally(() => setIsLoading(false));
  }, [isOpen, songs, isLoading]);

  useEffect(() => {
    if (!isOpen) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  function handlePlay(song: Song) {
    if (!songs) return;
    const index = songs.findIndex((candidate) => candidate.id === song.id);
    playQueue(songs, null, index === -1 ? 0 : index);
    setIsOpen(false);
  }

  const filtered = songs?.filter((song) => {
    const haystack = `${song.title} ${song.artist ?? ""}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label="Browse all songs"
        className="liquid-glass flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white sm:h-8 sm:w-8"
      >
        <ListMusic size={14} className="text-white/80" aria-hidden="true" />
      </button>

      {isOpen && renderOverlay()}
    </div>
  );

  function renderOverlay() {
    const overlay = (
      <>
        <div aria-hidden className="fixed inset-0 z-40 animate-pop-in bg-black/60" />
        <div className="liquid-glass-card animate-pop-in fixed inset-x-3 top-1/2 z-50 flex max-h-[80vh] w-auto max-w-md -translate-y-1/2 flex-col gap-2 rounded-2xl bg-[rgba(15,8,6,0.96)] p-3 shadow-lg sm:inset-x-auto sm:left-1/2 sm:w-full sm:-translate-x-1/2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-white">All songs</h2>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/50 transition hover:text-white active:scale-90"
            >
              <X size={16} />
            </button>
          </div>

          <div className="liquid-glass flex items-center gap-2 rounded-full px-3 py-1.5">
            <Search size={14} className="shrink-0 text-white/40" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search songs or artists"
              className="w-full bg-transparent text-[13px] text-white placeholder:text-white/40 focus:outline-none"
            />
          </div>

          <div className="no-scrollbar flex-1 overflow-y-auto">
            {isLoading && (
              <div className="flex items-center justify-center gap-2 py-8 text-white/60">
                <Loader2 size={16} className="animate-spin" />
                Loading songs…
              </div>
            )}

            {error && <p className="py-8 text-center text-sm text-white/60">{error}</p>}

            {!isLoading && !error && filtered?.length === 0 && (
              <p className="py-8 text-center text-sm text-white/60">No songs match your search.</p>
            )}

            {!isLoading &&
              filtered?.map((song) => (
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
                    onClick={() => handlePlay(song)}
                    aria-label={`Play ${song.title}`}
                    className="liquid-glass flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white transition-transform active:scale-90"
                  >
                    <Play size={12} className="fill-current" />
                  </button>
                </div>
              ))}
          </div>
        </div>
      </>
    );

    return isMounted ? createPortal(overlay, document.body) : null;
  }
}
