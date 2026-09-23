"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Music, Send, WifiOff, X } from "lucide-react";
import ChatMessage from "@/components/song-request/ChatMessage";
import CommunityFeedMessage from "@/components/song-request/CommunityFeedMessage";
import ChatInput from "@/components/song-request/ChatInput";
import TypingIndicator from "@/components/song-request/TypingIndicator";
import { useSongRequestChat } from "@/hooks/useSongRequestChat";
import type { ChatMessage as ChatMessageType } from "@/types/chat";
import type { CommunityRequestEvent } from "@/types/communityFeed";

const SONG_SUGGESTIONS = ["Afreen Afreen", "Tum Hi Ho", "Kun Faya Kun"];
const SONG_MIN = 2;
const SONG_MAX = 150;
const NAME_MIN = 2;
const NAME_MAX = 60;

interface SongRequestChatProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SongRequestChat({ isOpen, onClose }: SongRequestChatProps) {
  // This component stays mounted for the whole page visit (see Hero.tsx) —
  // closing only hides it via CSS below, rather than unmounting, so the
  // conversation (song/name typed so far, current step) survives reopening
  // instead of resetting to the greeting every time.
  const chat = useSongRequestChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Interleaves this visitor's own private conversation with the live,
  // site-wide feed of completed requests from everyone else — sorted into
  // one chronological timeline so a community entry appears in the right
  // place relative to whatever the visitor was doing at that moment.
  const timeline = useMemo(() => {
    type TimelineItem =
      | { kind: "message"; timestamp: number; message: ChatMessageType }
      | { kind: "community"; timestamp: number; event: CommunityRequestEvent };

    const items: TimelineItem[] = [
      ...chat.messages.map((message): TimelineItem => ({ kind: "message", timestamp: message.timestamp, message })),
      ...chat.communityFeed.map((event): TimelineItem => ({ kind: "community", timestamp: event.createdAt, event })),
    ];
    items.sort((a, b) => a.timestamp - b.timestamp);
    return items;
  }, [chat.messages, chat.communityFeed]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Mobile browsers resize the visual viewport as their address bar
  // shows/hides, which can lag behind `100dvh` and leave a sliver of the
  // real viewport exposed below this fixed-height dialog. The site's other
  // fixed-position chrome (mini player, notifications) would then poke
  // through in that gap, so hide it outright while the dialog is open.
  useEffect(() => {
    document.body.classList.toggle("song-request-chat-open", isOpen);
    return () => document.body.classList.remove("song-request-chat-open");
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [isOpen, timeline.length, chat.step, chat.isEditing]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-hidden={!isOpen}
      aria-label="Dhunzza Song Request Assistant"
      className={`fixed inset-0 z-50 items-center justify-center bg-black/70 backdrop-blur-sm sm:p-4 ${
        isOpen ? "flex" : "hidden"
      }`}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        onClick={(event) => event.stopPropagation()}
        className="liquid-glass-card relative flex h-[100dvh] w-full flex-col overflow-hidden sm:h-[85dvh] sm:max-h-[720px] sm:w-full sm:max-w-[560px] sm:rounded-[24px]"
      >
        {/* Warm accent glow + extra opacity wash, layered above the glass
            card's own translucent background rather than replacing it. The
            wash matters: liquid-glass-card's default opacity is tuned for
            small cards over a plain backdrop — over the busy Hero page
            (era pills, nav buttons) it let page content ghost through. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(120% 60% at 15% 0%, rgba(241,166,3,0.16) 0%, transparent 55%), radial-gradient(100% 50% at 100% 100%, rgba(252,165,3,0.12) 0%, transparent 60%), rgba(10,5,4,0.32)",
          }}
        />
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="liquid-glass liquid-glass-accent flex h-10 w-10 items-center justify-center rounded-full text-lg">
              🎵
            </span>
            <div>
              <p className="text-sm font-semibold text-white">Dhunzza</p>
              <p className="text-xs text-white/50">Song Request Assistant</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close song request chat"
            className="liquid-glass flex h-8 w-8 items-center justify-center rounded-full text-white transition hover:scale-105"
          >
            <X size={15} />
          </button>
        </div>

        {/* Messages — inner wrapper is min-h-full + justify-end so a short
            conversation hugs the bottom (near the input, like a normal chat)
            instead of sitting at the top with a large empty gap below it. */}
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
          aria-live="polite"
        >
          <div className="flex min-h-full flex-col justify-end gap-3">
            <AnimatePresence initial={false}>
              {timeline.map((item) =>
                item.kind === "community" ? (
                  <CommunityFeedMessage key={`event-${item.event.id}`} event={item.event} />
                ) : (
                  <ChatMessage
                    key={item.message.id}
                    message={item.message}
                    songName={chat.songName}
                    requesterName={chat.requesterName}
                  />
                )
              )}
            </AnimatePresence>

            {chat.step === "submitting" && (
              <div className="flex items-center gap-2">
                <TypingIndicator />
                <span className="text-xs text-white/50">Sending your request…</span>
              </div>
            )}

            {chat.step === "error" && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="liquid-glass w-fit max-w-[85%] rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm text-white/90"
              >
                {chat.errorText}
              </motion.div>
            )}
          </div>
        </div>

        {/* Footer / input area */}
        <div
          className="shrink-0 border-t border-white/10 px-4 pt-3"
          style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
        >
          {!chat.isOnline && (
            <p className="mb-2 flex items-center gap-1.5 text-xs text-amber-300">
              <WifiOff size={13} />
              You appear to be offline. Please reconnect and try again.
            </p>
          )}

          {chat.step === "song" && (
            <ChatInput
              key="song-input"
              placeholder="Enter song name…"
              buttonLabel="Next"
              minLength={SONG_MIN}
              maxLength={SONG_MAX}
              suggestions={SONG_SUGGESTIONS}
              onSubmit={chat.submitSong}
            />
          )}

          {chat.step === "name" && (
            <ChatInput
              key="name-input"
              placeholder="Enter your name…"
              buttonLabel="Continue"
              minLength={NAME_MIN}
              maxLength={NAME_MAX}
              onSubmit={chat.submitName}
            />
          )}

          {chat.step === "confirm" &&
            (chat.isEditing ? (
              <EditForm
                songName={chat.songName}
                requesterName={chat.requesterName}
                onCancel={chat.cancelEdit}
                onSave={chat.saveEdit}
              />
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={chat.startEdit}
                  className="liquid-glass flex-1 rounded-full py-2.5 text-sm font-semibold text-white transition"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={chat.send}
                  disabled={chat.cooldownSeconds > 0}
                  className="liquid-glass liquid-glass-accent flex flex-[2] items-center justify-center gap-1.5 rounded-full py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send size={14} />
                  {chat.cooldownSeconds > 0 ? `Wait ${chat.cooldownSeconds}s` : "Send Request"}
                </button>
              </div>
            ))}

          {chat.step === "submitting" && (
            <button
              type="button"
              disabled
              className="liquid-glass liquid-glass-accent w-full rounded-full py-2.5 text-sm font-semibold text-white opacity-60"
            >
              Sending your request...
            </button>
          )}

          {chat.step === "success" && (
            <div className="space-y-2">
              {chat.duplicateNotice && (
                <p className="text-center text-xs text-white">
                  🎵 This song was already requested recently — thanks for the vote of confidence!
                </p>
              )}
              <motion.button
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                type="button"
                onClick={chat.reset}
                className="liquid-glass liquid-glass-accent flex w-full items-center justify-center gap-1.5 rounded-full py-2.5 text-sm font-semibold text-white transition"
              >
                <Music size={14} />
                Request Another Song
              </motion.button>
            </div>
          )}

          {chat.step === "error" && (
            <button
              type="button"
              onClick={chat.retry}
              className="liquid-glass liquid-glass-accent w-full rounded-full py-2.5 text-sm font-semibold text-white transition"
            >
              Try Again
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function EditForm({
  songName,
  requesterName,
  onCancel,
  onSave,
}: {
  songName: string;
  requesterName: string;
  onCancel: () => void;
  onSave: (songName: string, requesterName: string) => void;
}) {
  const [song, setSong] = useState(songName);
  const [name, setName] = useState(requesterName);
  const isValid = song.trim().length >= SONG_MIN && name.trim().length >= NAME_MIN;

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={song}
        maxLength={SONG_MAX}
        onChange={(event) => setSong(event.target.value)}
        placeholder="Song name"
        aria-label="Edit song name"
        className="liquid-glass w-full rounded-full px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/40"
      />
      <input
        type="text"
        value={name}
        maxLength={NAME_MAX}
        onChange={(event) => setName(event.target.value)}
        placeholder="Your name"
        aria-label="Edit your name"
        className="liquid-glass w-full rounded-full px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/40"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="liquid-glass flex-1 rounded-full py-2 text-sm font-semibold text-white transition"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!isValid}
          onClick={() => onSave(song, name)}
          className="liquid-glass liquid-glass-accent flex-1 rounded-full py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save changes
        </button>
      </div>
    </div>
  );
}
