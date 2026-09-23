"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { deleteSong as deleteSongRequest } from "@/lib/firebase/songs";
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
            className="liquid-glass flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-white"
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
            <SongTable songs={songs} isLoading={isLoading} onDelete={handleDeleteSong} />
          </>
        ) : (
          <SongRequestsPanel onUploaded={handleUploaded} onToast={showToast} />
        )}
      </div>

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
