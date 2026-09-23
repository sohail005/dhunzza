"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Trash2 } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { deleteSong as deleteSongRequest, isPlayableSong } from "@/lib/firebase/songs";
import { getSongsOnce, removeSongFromCache, upsertSongInCache } from "@/lib/firebase/songsCache";
import type { Song } from "@/types/music";
import UploadForm from "@/components/admin/UploadForm";
import SongTable from "@/components/admin/SongTable";
import SongRequestsPanel from "@/components/admin/SongRequestsPanel";

interface ToastState {
  message: string;
  kind: "success" | "error";
}

type DashboardTab = "songs" | "requests";

export default function AdminDashboardPage() {
  const router = useRouter();
  const { signOut } = useAdminAuth();
  const [songs, setSongs] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [tab, setTab] = useState<DashboardTab>("songs");
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [pendingCleanup, setPendingCleanup] = useState(false);

  const showToast = useCallback((message: string, kind: "success" | "error") => {
    setToast({ message, kind });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const fetchedSongs = await getSongsOnce();
        setSongs(fetchedSongs);
      } catch {
        showToast("Couldn't load dashboard data — check your connection.", "error");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [showToast]);

  function handleUploaded(song: Song) {
    upsertSongInCache(song);
    setSongs((prev) => [song, ...prev]);
  }

  async function handleDeleteSong(song: Song) {
    try {
      await deleteSongRequest(song.id, song.audioPath, song.thumbnailPath);
      removeSongFromCache(song.id);
      setSongs((prev) => prev.filter((s) => s.id !== song.id));
      showToast(`"${song.title}" deleted.`, "success");
    } catch {
      showToast("Couldn't delete that song — try again.", "error");
    }
  }

  const unavailableSongs = songs.filter((song) => !isPlayableSong(song));

  async function handleRemoveUnavailable() {
    setIsCleaningUp(true);
    try {
      const targets = unavailableSongs;
      const deletedIds = new Set<string>();
      for (const song of targets) {
        try {
          await deleteSongRequest(song.id, song.audioPath, song.thumbnailPath);
          removeSongFromCache(song.id);
          deletedIds.add(song.id);
        } catch {
          // Left in the list — admin can retry the cleanup.
        }
      }
      setSongs((prev) => prev.filter((s) => !deletedIds.has(s.id)));
      if (deletedIds.size < targets.length) {
        showToast(`Removed ${deletedIds.size} of ${targets.length} unavailable songs.`, "error");
      } else {
        showToast(`Removed ${deletedIds.size} unavailable song${deletedIds.size === 1 ? "" : "s"}.`, "success");
      }
    } finally {
      setIsCleaningUp(false);
      setPendingCleanup(false);
    }
  }

  async function handleLogout() {
    await signOut();
    router.replace("/admin/login");
  }

  return (
    <div className="min-h-screen bg-transparent px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Dhunzza Admin</h1>
          <button
            type="button"
            onClick={handleLogout}
            className="liquid-glass bg-red-700 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-white"
          >
            <LogOut size={14} />
            Logout
          </button>
        </div>

        <div className="mb-6 flex gap-1 rounded-full border border-white/15 bg-black/20 p-1 text-sm">
          {(["songs", "requests"] as DashboardTab[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setTab(option)}
              className={`flex-1 rounded-full py-1.5 capitalize transition ${
                tab === option ? "bg-[var(--accent)] font-semibold text-black" : "text-white/60"
              }`}
            >
              {option === "requests" ? "Song Requests" : "Songs"}
            </button>
          ))}
        </div>

        {tab === "songs" ? (
          <>
            <div className="mb-6">
              <UploadForm onUploaded={handleUploaded} onToast={showToast} />
            </div>
            {!isLoading && unavailableSongs.length > 0 && (
              <div className="liquid-glass-card mb-6 flex items-center justify-between gap-3 rounded-2xl p-4 text-sm">
                <p className="text-white/80">
                  {unavailableSongs.length} song{unavailableSongs.length === 1 ? "" : "s"} can&apos;t be
                  played (missing audio) and {unavailableSongs.length === 1 ? "is" : "are"} hidden from
                  listeners.
                </p>
                <button
                  type="button"
                  onClick={() => setPendingCleanup(true)}
                  className="liquid-glass flex shrink-0 items-center gap-1.5 rounded-full bg-red-700 px-3 py-1.5 text-white"
                >
                  <Trash2 size={14} />
                  Remove from DB
                </button>
              </div>
            )}
            <SongTable songs={songs} isLoading={isLoading} onDelete={handleDeleteSong} />
          </>
        ) : (
          <SongRequestsPanel onUploaded={handleUploaded} onToast={showToast} />
        )}
      </div>

      {pendingCleanup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="liquid-glass-card w-full max-w-xs rounded-2xl p-5 text-center text-white">
            <p className="mb-4 text-sm">
              Permanently delete {unavailableSongs.length} unavailable song
              {unavailableSongs.length === 1 ? "" : "s"} from the database? This can&apos;t be undone.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPendingCleanup(false)}
                disabled={isCleaningUp}
                className="liquid-glass flex-1 rounded-xl py-2 text-sm disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRemoveUnavailable}
                disabled={isCleaningUp}
                className="flex-1 rounded-xl bg-red-500/80 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-60"
              >
                {isCleaningUp ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`fixed bottom-4 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 rounded-xl px-4 py-2.5 text-center text-sm text-white shadow-lg ${
            toast.kind === "success" ? "bg-emerald-600/90" : "bg-red-600/90"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
