"use client";

import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import type { EraId, Mood, Song } from "@/types/music";
import { MAX_UPLOAD_BYTES, readAudioDuration, uploadSong } from "@/lib/firebase/songs";
import { fulfillMatchingSongRequests } from "@/lib/firebase/songRequestFulfillment";
import { fulfillSongRequest } from "@/lib/firebase/songRequestsAdmin";
import { DEFAULT_ERA, ERAS, MOODS } from "@/lib/eras";

/** When set, this upload is fulfilling a claimed song request — the
 * requester name comes from the trusted request record (read-only, never
 * editable), and completion calls fulfillSongRequest instead of the
 * best-effort title-matching fallback. */
export interface RequestContext {
  requestId: string;
  requesterName: string;
  songName: string;
}

interface UploadFormProps {
  onUploaded: (song: Song) => void;
  onToast: (message: string, kind: "success" | "error") => void;
  request?: RequestContext | null;
}

function formatFileSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(mb < 10 ? 2 : 1)} MB`;
}

// Audio is stored/served as base64 through Realtime Database, which bills
// (and free-tier-caps) by bytes downloaded on every play — every song
// uploaded here gets streamed by every listener. Above this bitrate, the
// file is larger than a background-listening use case needs, so a re-encode
// meaningfully cuts ongoing bandwidth for no audible difference on typical
// playback devices.
const BITRATE_WARNING_THRESHOLD_BPS = 160_000; // 160 kbps

function estimateBitrateBps(fileBytes: number, durationSeconds: number): number {
  return (fileBytes * 8) / durationSeconds;
}

export default function UploadForm({ onUploaded, onToast, request = null }: UploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState(request?.songName ?? "");
  const [artist, setArtist] = useState("");
  const [era, setEra] = useState<EraId>(DEFAULT_ERA);
  const [mood, setMood] = useState<Mood>("neutral");
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bitrateWarning, setBitrateWarning] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function validateAndSetFile(candidate: File | null) {
    if (!candidate) return;
    if (!candidate.type.startsWith("audio/")) {
      setError("File must be an audio file (MP3).");
      return;
    }
    if (candidate.size > MAX_UPLOAD_BYTES) {
      setError(`File is too large (max ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))}MB).`);
      return;
    }
    setError(null);
    setBitrateWarning(null);
    setFile(candidate);
    if (!title) setTitle(candidate.name.replace(/\.[^/.]+$/, ""));

    readAudioDuration(candidate).then((duration) => {
      if (!duration) return;
      const bitrateBps = estimateBitrateBps(candidate.size, duration);
      if (bitrateBps > BITRATE_WARNING_THRESHOLD_BPS) {
        const kbps = Math.round(bitrateBps / 1000);
        setBitrateWarning(
          `This file is encoded at roughly ${kbps} kbps. Dhunzza streams every play through a bandwidth-limited free database — re-encoding to ~128 kbps before uploading would cut this file's size (and everyone's download cost) by roughly ${Math.round((1 - 128 / kbps) * 100)}% with no noticeable quality loss for background listening. You can still upload as-is.`
        );
      }
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!file) {
      setError("Select an MP3 file.");
      return;
    }
    if (!title.trim()) {
      setError("Song title cannot be empty.");
      return;
    }

    setProgress(0);
    try {
      const song = await uploadSong({
        file,
        title,
        artist: artist || null,
        era,
        mood: mood === "neutral" ? null : mood,
        onProgress: setProgress,
      });
      onUploaded(song);

      if (request) {
        // Re-reads the claimed request server-side and verifies this admin
        // still owns it before marking it fulfilled — never trusts the
        // in-memory request prop alone.
        setProgress(100);
        try {
          await fulfillSongRequest({ requestId: request.requestId, songId: song.id, songTitle: song.title });
          onToast("Song added successfully and the requester has been notified.", "success");
        } catch (fulfillError) {
          const message =
            fulfillError instanceof Error
              ? fulfillError.message
              : "The song was uploaded, but the request couldn't be marked fulfilled.";
          onToast(message, "error");
        }
      } else {
        onToast(`"${song.title}" uploaded.`, "success");
        // Best-effort — closes the loop on any pending chatbot request for
        // this song. Never blocks or fails the upload itself.
        fulfillMatchingSongRequests(song.title, song.id).catch(() => {});
      }

      setFile(null);
      setTitle(request?.songName ?? "");
      setArtist("");
      setMood("neutral");
      setBitrateWarning(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed.";
      setError(message);
      onToast(message, "error");
    } finally {
      setProgress(null);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="liquid-glass-card rounded-2xl p-5 text-white">
      <h2 className="mb-4 text-sm font-semibold text-white/80 uppercase">
        {request ? "Add Requested Song" : "Upload MP3"}
      </h2>

      {request && (
        <label className="mb-4 block text-sm">
          <span className="mb-1 block text-white/60">Requested by</span>
          <input
            type="text"
            value={request.requesterName}
            readOnly
            disabled
            aria-readonly="true"
            className="w-full cursor-not-allowed rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white/70 outline-none"
          />
        </label>
      )}

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          validateAndSetFile(event.dataTransfer.files[0] ?? null);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`mb-4 flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
          isDragging ? "border-amber-400 bg-amber-400/10" : "border-white/20 hover:border-white/35"
        }`}
      >
        <UploadCloud size={22} className="text-white/60" />
        <p className={`text-sm ${file ? "font-medium text-green-400" : "text-white/70"}`}>
          {file ? file.name : "Drag & drop an MP3 here, or click to browse"}
        </p>
        {file && <p className="text-xs text-white/50">{formatFileSize(file.size)}</p>}
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.mp3"
          className="hidden"
          onChange={(event) => validateAndSetFile(event.target.files?.[0] ?? null)}
        />
      </div>

      <label className="mb-3 block text-sm">
        <span className="mb-1 block text-white/60">Title</span>
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-white outline-none focus:border-amber-400/60"
        />
      </label>

      <label className="mb-4 block text-sm">
        <span className="mb-1 block text-white/60">Artist (optional)</span>
        <input
          type="text"
          value={artist}
          onChange={(event) => setArtist(event.target.value)}
          className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-white outline-none focus:border-amber-400/60"
        />
      </label>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="mb-1 block text-white/60">Era</span>
          <select
            value={era}
            onChange={(event) => setEra(event.target.value as EraId)}
            className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-white outline-none focus:border-amber-400/60"
          >
            {ERAS.map((e) => (
              <option key={e.id} value={e.id} className="bg-[#1c0704]">
                {e.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-white/60">Mood</span>
          <select
            value={mood}
            onChange={(event) => setMood(event.target.value as Mood)}
            className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-white outline-none focus:border-amber-400/60"
          >
            {MOODS.map((m) => (
              <option key={m.id} value={m.id} className="bg-[#1c0704]">
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {progress !== null && (
        <div className="mb-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-white/50">{progress}%</p>
        </div>
      )}

      {bitrateWarning && <p className="mb-4 text-xs text-amber-400">{bitrateWarning}</p>}

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={progress !== null}
        className="liquid-glass liquid-glass-accent w-full rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60"
      >
        {progress === null
          ? request
            ? "Add Song"
            : "Upload"
          : progress < 100
            ? `Uploading… ${progress}%`
            : "Saving Song…"}
      </button>
    </form>
  );
}
