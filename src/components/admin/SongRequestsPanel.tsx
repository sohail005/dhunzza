"use client";

import { useEffect, useMemo, useState } from "react";
import { Music, Search, Trash2 } from "lucide-react";
import type { Song } from "@/types/music";
import UploadForm, { type RequestContext } from "@/components/admin/UploadForm";
import {
  claimSongRequest,
  CLAIM_STALE_MS,
  deleteSongRequest,
  releaseSongRequestClaim,
  subscribeToSongRequests,
  type AdminSongRequest,
} from "@/lib/firebase/songRequestsAdmin";

interface SongRequestsPanelProps {
  onUploaded: (song: Song) => void;
  onToast: (message: string, kind: "success" | "error") => void;
}

type StatusFilter = "all" | "pending" | "reviewing";

function formatRequestedAt(epochMs: number): string {
  return new Date(epochMs).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function SongRequestsPanel({ onUploaded, onToast }: SongRequestsPanelProps) {
  const [requests, setRequests] = useState<AdminSongRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [activeRequest, setActiveRequest] = useState<AdminSongRequest | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminSongRequest | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  // Ticks periodically so stale-claim detection (Date.now() - reviewedAt)
  // re-evaluates over time without calling the impure Date.now() at render
  // time — updated only from a timer callback, never synchronously in an
  // effect body.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToSongRequests(
      (items) => {
        setRequests(items);
        setIsLoading(false);
        setLoadError(null);
      },
      () => {
        setIsLoading(false);
        setLoadError("Couldn't load song requests — check your connection.");
      }
    );
    return unsubscribe;
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((request) => {
      if (statusFilter !== "all" && request.status !== statusFilter) return false;
      if (!q) return true;
      return (
        request.requesterName.toLowerCase().includes(q) || request.songName.toLowerCase().includes(q)
      );
    });
  }, [requests, search, statusFilter]);

  async function handleAddSong(request: AdminSongRequest) {
    setClaimingId(request.id);
    try {
      const result = await claimSongRequest(request.id);
      if (!result.ok) {
        onToast("This request has already been claimed or fulfilled.", "error");
        return;
      }
      setActiveRequest(request);
    } catch {
      onToast("Couldn't claim this request — try again.", "error");
    } finally {
      setClaimingId(null);
    }
  }

  async function handleRetryStaleClaim(request: AdminSongRequest) {
    setClaimingId(request.id);
    try {
      await releaseSongRequestClaim(request.id);
      const result = await claimSongRequest(request.id);
      if (!result.ok) {
        onToast("This request has already been claimed or fulfilled.", "error");
        return;
      }
      setActiveRequest(request);
    } catch {
      onToast("Couldn't claim this request — try again.", "error");
    } finally {
      setClaimingId(null);
    }
  }

  async function closeDialog(release: boolean) {
    const request = activeRequest;
    setActiveRequest(null);
    if (release && request) {
      await releaseSongRequestClaim(request.id).catch(() => {});
    }
  }

  async function confirmDeleteRequest() {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await deleteSongRequest(pendingDelete.id);
      onToast(`Request from ${pendingDelete.requesterName} deleted.`, "success");
      setPendingDelete(null);
    } catch {
      onToast("Couldn't delete this request — try again.", "error");
    } finally {
      setIsDeleting(false);
    }
  }

  const requestContext: RequestContext | null = activeRequest
    ? { requestId: activeRequest.id, requesterName: activeRequest.requesterName, songName: activeRequest.songName }
    : null;

  return (
    <div className="liquid-glass-card rounded-2xl p-5 text-white">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold text-white/80 uppercase">
          Song Requests {!isLoading && <span className="text-white/40">({requests.length})</span>}
        </h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex gap-1 rounded-full border border-white/15 bg-black/20 p-1 text-xs">
            {(["all", "pending", "reviewing"] as StatusFilter[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setStatusFilter(option)}
                className={`rounded-full px-2.5 py-1 capitalize transition ${
                  statusFilter === option ? "bg-[var(--accent)] font-semibold text-black" : "text-white/60"
                }`}
              >
                {option === "reviewing" ? "Processing" : option}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-56">
            <Search size={14} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search requester or song…"
              className="w-full rounded-full border border-white/15 bg-black/30 py-1.5 pr-3 pl-8 text-xs text-white outline-none focus:border-amber-400/60"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-white/50">Loading song requests…</p>
      ) : loadError ? (
        <p className="py-8 text-center text-sm text-red-400">{loadError}</p>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-white/50">
          {requests.length === 0 ? "No pending song requests." : "No requests match your search."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((request) => {
            const isStale =
              request.status === "reviewing" &&
              typeof request.reviewedAt === "number" &&
              now - request.reviewedAt > CLAIM_STALE_MS;
            return (
              <li
                key={request.id}
                className="flex flex-col gap-2 rounded-xl border border-white/10 bg-black/20 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-2">
                  <Music size={16} className="mt-0.5 shrink-0 text-white/40" />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">{request.requesterName}</p>
                    <p className="truncate text-sm text-white/70">Requested: {request.songName}</p>
                    <p className="text-xs text-white/40">Requested: {formatRequestedAt(request.createdAt)}</p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                  {request.status === "pending" ? (
                    <button
                      type="button"
                      onClick={() => handleAddSong(request)}
                      disabled={claimingId === request.id}
                      className="liquid-glass liquid-glass-accent rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
                    >
                      {claimingId === request.id ? "Claiming…" : "Add Song"}
                    </button>
                  ) : isStale ? (
                    <button
                      type="button"
                      onClick={() => handleRetryStaleClaim(request)}
                      disabled={claimingId === request.id}
                      className="liquid-glass rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
                    >
                      {claimingId === request.id ? "Claiming…" : "Retry"}
                    </button>
                  ) : (
                    <span className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/50">
                      Processing…
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setPendingDelete(request)}
                    disabled={claimingId === request.id}
                    aria-label={`Delete request from ${request.requesterName}`}
                    className="text-white/50 transition hover:text-red-400 disabled:opacity-40"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {requestContext && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Add requested song"
        >
          <div className="w-full max-w-sm">
            <UploadForm
              request={requestContext}
              onToast={onToast}
              onUploaded={(song) => {
                onUploaded(song);
                setActiveRequest(null);
              }}
            />
            <button
              type="button"
              onClick={() => closeDialog(true)}
              className="liquid-glass mt-3 w-full rounded-xl py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="liquid-glass-card w-full max-w-xs rounded-2xl p-5 text-center text-white">
            <p className="mb-4 text-sm">
              Delete the request for <span className="font-semibold">{pendingDelete.songName}</span> from{" "}
              <span className="font-semibold">{pendingDelete.requesterName}</span>? This also removes their
              saved chat session and its entry from the live requests feed — can&apos;t be undone.
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
                onClick={confirmDeleteRequest}
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
