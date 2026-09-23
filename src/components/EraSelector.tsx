"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Clock, Loader2 } from "lucide-react";
import { useRadio } from "@/hooks/useRadio";
import { ERA_BY_ID, ERAS } from "@/lib/eras";
import { getSongsOnce } from "@/lib/firebase/songsCache";
import { isPlayableSong } from "@/lib/firebase/songs";
import type { EraId } from "@/types/music";

export default function EraSelector({ className = "" }: { className?: string }) {
  const { travelToEra, currentEra, isTraveling } = useRadio();
  const [isOpen, setIsOpen] = useState(false);
  const [counts, setCounts] = useState<Record<EraId, number> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || counts) return;
    // Derived from the shared songs cache (already loaded/reused elsewhere)
    // instead of 5 separate getCountFromServer aggregation queries — the
    // full list is already in memory once any consumer has loaded it.
    getSongsOnce()
      .then((songs) => {
        const grouped = Object.fromEntries(ERAS.map((era) => [era.id, 0])) as Record<EraId, number>;
        for (const song of songs) if (isPlayableSong(song)) grouped[song.era] += 1;
        setCounts(grouped);
      })
      .catch(() => {});
  }, [isOpen, counts]);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  function handleSelect(eraId: (typeof ERAS)[number]["id"]) {
    setIsOpen(false);
    if (eraId === currentEra) return;
    travelToEra(eraId);
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={isTraveling}
        className="liquid-glass flex w-full items-center gap-1 rounded-full px-2 py-1.5 text-[11px] font-semibold whitespace-nowrap text-white disabled:opacity-60 sm:gap-1.5 sm:px-3 sm:text-[14px]"
      >
        {isTraveling ? (
          <Loader2 size={12} className="shrink-0 animate-spin text-white/80 sm:h-3.5 sm:w-3.5" aria-hidden="true" />
        ) : (
          <Clock size={12} className="shrink-0 text-white/80 sm:h-3.5 sm:w-3.5" aria-hidden="true" />
        )}
        <span className="truncate">{currentEra ? ERA_BY_ID[currentEra].label : "Era"}</span>
        <ChevronDown
          size={12}
          className={`shrink-0 text-white/60 transition-transform sm:h-3.25 sm:w-3.25 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="liquid-glass-card no-scrollbar absolute bottom-full left-0 z-40 mb-2 flex max-h-72 w-40 flex-col gap-0.5 overflow-y-auto rounded-2xl bg-black/90 p-1.5"
        >
          {ERAS.map((era) => (
            <button
              key={era.id}
              type="button"
              role="option"
              aria-selected={currentEra === era.id}
              onClick={() => handleSelect(era.id)}
              className={`rounded-xl px-3 py-2 text-left text-sm font-medium text-white transition hover:bg-amber-400/25 ${
                currentEra === era.id ? "bg-amber-400/15" : ""
              }`}
            >
              {era.label}
              <span className="block text-[10px] font-normal text-white/50">
                {era.years}
                {counts && ` · ${counts[era.id]} song${counts[era.id] === 1 ? "" : "s"}`}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
