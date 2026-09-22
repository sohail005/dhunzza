"use client";

import { useState } from "react";
import { Loader2, Music, Play } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { ChatMessage as ChatMessageType } from "@/types/chat";
import RequestPreview from "@/components/song-request/RequestPreview";
import { fetchSongById } from "@/lib/firebase/songs";
import { useRadio } from "@/hooks/useRadio";

interface ChatMessageProps {
  message: ChatMessageType;
  songName?: string;
  requesterName?: string;
}

function SongAddedMessage({ songName, songId }: { songName: string; songId: string }) {
  const { playRecentlyAddedSong } = useRadio();
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  async function handlePlay() {
    setStatus("loading");
    try {
      const song = await fetchSongById(songId);
      if (!song) {
        setStatus("error");
        return;
      }
      playRecentlyAddedSong(song);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="liquid-glass-card flex w-fit max-w-[85%] items-center gap-3 rounded-2xl rounded-bl-sm p-3">
      <span className="liquid-glass liquid-glass-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-accent">
        <Music size={16} />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-white/60">🎉 Your request is on Dhunzza!</p>
        <p className="truncate text-sm font-semibold text-white">{songName}</p>
        {status === "error" && <p className="text-xs text-red-400">Couldn&apos;t load this song.</p>}
      </div>
      <button
        type="button"
        onClick={handlePlay}
        disabled={status === "loading"}
        aria-label={`Play ${songName}`}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-accent to-accent-dark text-background transition disabled:opacity-60"
      >
        {status === "loading" ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <Play size={14} className="fill-current" />
        )}
      </button>
    </div>
  );
}

export default function ChatMessage({ message, songName, requesterName }: ChatMessageProps) {
  const reduceMotion = useReducedMotion();
  const isBot = message.role === "bot";

  const initial = reduceMotion
    ? { opacity: 0 }
    : isBot
      ? { opacity: 0, y: 8 }
      : { opacity: 0, x: 12 };

  if (message.type === "request-preview") {
    return (
      <motion.div
        initial={initial}
        animate={{ opacity: 1, y: 0, x: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="flex justify-start"
      >
        <RequestPreview songName={songName ?? ""} requesterName={requesterName ?? ""} />
      </motion.div>
    );
  }

  if (message.type === "song-added" && message.songId) {
    return (
      <motion.div
        initial={initial}
        animate={{ opacity: 1, y: 0, x: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="flex justify-start"
      >
        <SongAddedMessage songName={message.content ?? ""} songId={message.songId} />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={initial}
      animate={{ opacity: 1, y: 0, x: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`flex ${isBot ? "justify-start" : "justify-end"}`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed wrap-break-word whitespace-pre-wrap ${
          isBot
            ? "liquid-glass rounded-bl-sm text-white/90"
            : "rounded-br-sm bg-linear-to-br from-accent to-accent-dark font-medium text-background"
        }`}
      >
        {message.content}
      </div>
    </motion.div>
  );
}
