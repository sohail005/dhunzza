"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ListMusic, Loader2 } from "lucide-react";
import { useRadio } from "@/hooks/useRadio";
import { fetchCategories, fetchSongsByCategory } from "@/lib/firebase/songs";
import type { Category } from "@/types/music";

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function CategorySelector({ className = "" }: { className?: string }) {
  const { playQueue, currentCategory } = useRadio();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchCategories()
      .then(setCategories)
      .catch(() => {});
  }, []);

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

  useEffect(() => {
    if (!statusMessage) return;
    const timeout = window.setTimeout(() => setStatusMessage(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [statusMessage]);

  async function handleSelect(category: Category) {
    setIsOpen(false);
    setLoadingId(category.id);
    setStatusMessage(null);
    try {
      const songs = await fetchSongsByCategory(category.id);
      if (songs.length === 0) {
        setStatusMessage(`No songs in "${category.name}" yet.`);
        return;
      }
      playQueue(shuffle(songs), { id: category.id, name: category.name });
    } catch {
      setStatusMessage("Couldn't load that category — check your connection.");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="liquid-glass flex w-full items-center gap-1 rounded-full px-2 py-1.5 text-[11px] font-semibold whitespace-nowrap text-white sm:gap-1.5 sm:px-3 sm:text-[14px]"
      >
        {loadingId ? (
          <Loader2 size={12} className="shrink-0 animate-spin text-white/80 sm:h-3.5 sm:w-3.5" aria-hidden="true" />
        ) : (
          <ListMusic size={12} className="shrink-0 text-white/80 sm:h-3.5 sm:w-3.5" aria-hidden="true" />
        )}
        <span className="truncate">{currentCategory?.name ?? "Category"}</span>
        <ChevronDown
          size={12}
          className={`shrink-0 text-white/60 transition-transform sm:h-3.25 sm:w-3.25 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {statusMessage && (
        <p className="liquid-glass absolute bottom-full left-1/2 z-40 mb-2 w-max max-w-56 -translate-x-1/2 rounded-xl px-3 py-2 text-center text-xs text-white/90">
          {statusMessage}
        </p>
      )}

      {isOpen && (
        <div
          role="listbox"
          className="liquid-glass-card no-scrollbar absolute top-full left-0 z-40 mt-2 flex max-h-60 w-40 flex-col gap-0.5 overflow-y-auto rounded-2xl bg-black/90 p-1.5"
        >
          {categories.length === 0 ? (
            <p className="px-3 py-2 text-xs text-white/50">No categories yet.</p>
          ) : (
            categories.map((category) => (
              <button
                key={category.id}
                type="button"
                role="option"
                aria-selected={currentCategory?.id === category.id}
                onClick={() => handleSelect(category)}
                className={`rounded-xl px-3 py-2 text-left text-sm font-medium text-white transition hover:bg-amber-400/25 ${
                  currentCategory?.id === category.id ? "bg-amber-400/15" : ""
                }`}
              >
                {category.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
