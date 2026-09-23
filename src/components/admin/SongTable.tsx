"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search, Trash2 } from "lucide-react";
import type { EraId, Song } from "@/types/music";
import SongThumbnail from "@/components/SongThumbnail";
import Dropdown from "@/components/Dropdown";
import { ERA_BY_ID, ERAS } from "@/lib/eras";
import { isPlayableSong } from "@/lib/firebase/songs";

type EraFilter = EraId | "all";

const ERA_FILTER_OPTIONS = [{ value: "all", label: "All eras" }, ...ERAS.map((era) => ({ value: era.id, label: era.label }))];

interface SongTableProps {
  songs: Song[];
  isLoading: boolean;
  onDelete: (song: Song) => Promise<void>;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function SongTable({ songs, isLoading, onDelete }: SongTableProps) {
  const [search, setSearch] = useState("");
  const [eraFilter, setEraFilter] = useState<EraFilter>("all");
  const [pendingDelete, setPendingDelete] = useState<Song | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return songs.filter((song) => {
      if (eraFilter !== "all" && song.era !== eraFilter) return false;
      if (!query) return true;
      return (
        song.title.toLowerCase().includes(query) ||
        song.era.toLowerCase().includes(query) ||
        (song.artist ?? "").toLowerCase().includes(query)
      );
    });
  }, [songs, search, eraFilter]);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(pendingDelete);
      setPendingDelete(null);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="liquid-glass-card rounded-2xl p-5 text-white">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-controls="song-table-content"
        className={`flex w-full items-center justify-between gap-3 ${isOpen ? "mb-4" : ""}`}
      >
        <h2 className="text-sm font-semibold text-white/80 uppercase">
          Songs - {!isLoading && <span className="text-green/60 text-md">{songs.length}</span>}
        </h2>
        <ChevronDown
          size={16}
          className={`shrink-0 text-white/50 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div id="song-table-content">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row">
            <div className="relative w-full sm:w-56">
              <Search size={14} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search…"
                className="w-full rounded-full border bg-black/30 py-1.5 pr-3 pl-8 text-xs text-white outline-none focus:border-amber-400/60"
              />
            </div>
            <Dropdown
              value={eraFilter}
              options={ERA_FILTER_OPTIONS}
              onChange={(value) => setEraFilter(value as EraFilter)}
              ariaLabel="Filter by era"
              className="w-full sm:w-40"
              buttonClassName="rounded-full border border-white/15 bg-black/30 px-3 py-1.5 text-xs focus:border-amber-400/60"
            />
          </div>

          {isLoading ? (
            <p className="py-8 text-center text-sm text-white/50">Loading songs…</p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/50">
              {songs.length === 0 ? "No songs uploaded yet." : "No songs match your search."}
            </p>
          ) : (
            <div className="no-scrollbar overflow-x-auto">
              <table className="w-full min-w-120 text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs text-white/40 uppercase">
                    <th className="py-2 pr-3 font-medium" />
                    <th className="py-2 pr-3 font-medium">Title</th>
                    <th className="py-2 pr-3 font-medium">Era</th>
                    <th className="py-2 pr-3 font-medium">Duration</th>
                    <th className="py-2 pr-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((song) => (
                    <tr key={song.id} className="border-b border-white/5 last:border-0">
                      <td className="py-2.5 pr-3">
                        <SongThumbnail thumbnailPath={song.thumbnailPath} />
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-white">{song.title}</p>
                          {!isPlayableSong(song) && (
                            <span className="shrink-0 rounded-full bg-red-500/20 px-1.5 py-0.5 text-[10px] font-medium text-red-400">
                              Unavailable
                            </span>
                          )}
                        </div>
                        {song.artist && <p className="text-xs text-white/40">{song.artist}</p>}
                      </td>
                      <td className="py-2.5 pr-3 text-white/70">{ERA_BY_ID[song.era]?.label ?? song.era}</td>
                      <td className="py-2.5 pr-3 text-white/50 tabular-nums">
                        {formatDuration(song.duration)}
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        <button
                          type="button"
                          onClick={() => setPendingDelete(song)}
                          aria-label={`Delete ${song.title}`}
                          className="text-white/50 transition hover:text-red-400"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="liquid-glass-card w-full max-w-xs rounded-2xl p-5 text-center text-white">
            <p className="mb-4 text-sm">
              Delete <span className="font-semibold">{pendingDelete.title}</span>? This can&apos;t
              be undone.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                disabled={isDeleting}
                className="liquid-glass flex-1 rounded-xl py-2 text-sm disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex-1 rounded-xl bg-red-500/80 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-60"
              >
                {isDeleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
