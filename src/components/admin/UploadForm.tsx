"use client";

import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import type { Category, Song } from "@/types/music";
import { MAX_UPLOAD_BYTES, uploadSong } from "@/lib/firebase/songs";
import CategoryManager from "@/components/admin/CategoryManager";

interface UploadFormProps {
  categories: Category[];
  onUploaded: (song: Song) => void;
  onToast: (message: string, kind: "success" | "error") => void;
  createCategory: (name: string) => Promise<Category>;
}

export default function UploadForm({
  categories,
  onUploaded,
  onToast,
  createCategory,
}: UploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    setFile(candidate);
    if (!title) setTitle(candidate.name.replace(/\.[^/.]+$/, ""));
  }

  async function handleCreateCategory(name: string) {
    const category = await createCategory(name);
    setCategoryId(category.id);
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
    const category = categories.find((c) => c.id === categoryId);
    if (!category) {
      setError("Select a category.");
      return;
    }

    setProgress(0);
    try {
      const song = await uploadSong({
        file,
        title,
        artist: artist || null,
        categoryId: category.id,
        categoryName: category.name,
        onProgress: setProgress,
      });
      onUploaded(song);
      onToast(`"${song.title}" uploaded.`, "success");
      setFile(null);
      setTitle("");
      setArtist("");
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
      <h2 className="mb-4 text-sm font-semibold text-white/80 uppercase">Upload MP3</h2>

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

      <div className="mb-4">
        <CategoryManager
          categories={categories}
          selectedCategoryId={categoryId}
          onSelectCategory={setCategoryId}
          onCreateCategory={handleCreateCategory}
        />
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

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={progress !== null}
        className="liquid-glass liquid-glass-accent w-full rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60"
      >
        {progress !== null ? "Uploading…" : "Upload"}
      </button>
    </form>
  );
}
