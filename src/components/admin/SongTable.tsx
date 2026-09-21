"use client";

import { useMemo, useState } from "react";
import { Search, Trash2 } from "lucide-react";
import type { Song } from "@/types/music";
import SongThumbnail from "@/components/SongThumbnail";

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
  const [pendingDelete, setPendingDelete] = useState<Song | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return songs;
    return songs.filter(
      (song) =>
        song.title.toLowerCase().includes(query) ||
        song.categoryName.toLowerCase().includes(query) ||
        (song.artist ?? "").toLowerCase().includes(query)
    );
  }, [songs, search]);

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
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold text-white/80 uppercase">
          Songs {!isLoading && <span className="text-white/40">({songs.length})</span>}
        </h2>
        <div className="relative w-full sm:w-56">
          <Search size={14} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search…"
            className="w-full rounded-full border border-white/15 bg-black/30 py-1.5 pr-3 pl-8 text-xs text-white outline-none focus:border-amber-400/60"
          />
        </div>
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-white/50">Loading songs…</p>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-white/50">
          {songs.length === 0 ? "No songs uploaded yet." : "No songs match your search."}
        </p>
      ) : (
        <div className="no-scrollbar overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs text-white/40 uppercase">
                <th className="py-2 pr-3 font-medium" />
                <th className="py-2 pr-3 font-medium">Title</th>
                <th className="py-2 pr-3 font-medium">Category</th>
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
                    <p className="font-medium text-white">{song.title}</p>
                    {song.artist && <p className="text-xs text-white/40">{song.artist}</p>}
                  </td>
                  <td className="py-2.5 pr-3 text-white/70">{song.categoryName}</td>
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

      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => !isDeleting && setPendingDelete(null)}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="liquid-glass-card w-full max-w-xs rounded-2xl p-5 text-center text-white"
          >
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
