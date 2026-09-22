"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage, ChatStep } from "@/types/chat";
import type { CommunityRequestEvent } from "@/types/communityFeed";
import { loadChatSession, saveChatSession } from "@/lib/firebase/chatSessions";
import { subscribeToCommunityFeed } from "@/lib/firebase/communityFeed";

const SESSION_KEY = "dhunzza.session-id";
const LAST_SUBMIT_KEY = "dhunzza.song-request.last-submit";
// Client-side mirror of the server cooldown (see SESSION_WINDOW_MS in
// src/app/api/song-request/route.ts) — purely for UX so the button
// disables itself instantly instead of waiting on a 429 round-trip.
const COOLDOWN_MS = 45_000;

const GREETING =
  "Hey! \u{1F44B} Want to help us grow Dhunzza? Tell me a song you'd love to see here.";
const ASK_NAME = "Nice choice! \u{1F3B5} Who should we credit this request to?";
const CONFIRM_INTRO = "Almost done! ✨ Here's your request:";
const GENERIC_ERROR = "Hmm, something went wrong while sending your request. \u{1F615} Please try again.";
const OFFLINE_ERROR = "You appear to be offline. Please reconnect and try again.";

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = window.sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function makeMessage(role: ChatMessage["role"], content: string, type: ChatMessage["type"] = "text"): ChatMessage {
  return { id: crypto.randomUUID(), role, content, type, timestamp: Date.now() };
}

export function useSongRequestChat() {
  const [step, setStep] = useState<ChatStep>("song");
  const [messages, setMessages] = useState<ChatMessage[]>(() => [makeMessage("bot", GREETING)]);
  const [songName, setSongName] = useState("");
  const [requesterName, setRequesterName] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [duplicateNotice, setDuplicateNotice] = useState(false);
  // Both start at a fixed, SSR-safe default and are corrected from the real
  // browser APIs (localStorage, navigator.onLine) in the effect below.
  // Reading those APIs during the initial state (as a useState lazy
  // initializer) makes the very first client render diverge from the
  // server-rendered HTML — this component is now always mounted (see
  // SongRequestChat's isOpen prop), so it's SSR'd even while "closed",
  // and that divergence became a real hydration mismatch.
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [isOnline, setIsOnline] = useState(true);
  // Live, site-wide feed of completed requests from every visitor — never
  // persisted into this session's own saved draft (see chatSessions.ts),
  // just rendered alongside it for as long as the chat stays open.
  const [communityFeed, setCommunityFeed] = useState<CommunityRequestEvent[]>([]);
  const submitLock = useRef(false);

  useEffect(() => {
    return subscribeToCommunityFeed(setCommunityFeed);
  }, []);

  useEffect(() => {
    // Syncing from browser-only APIs right after mount is the correct fix
    // for the SSR hydration mismatch described above, not an anti-pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsOnline(navigator.onLine);
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    const stored = window.localStorage.getItem(LAST_SUBMIT_KEY);
    if (stored) {
      const until = Number(stored) + COOLDOWN_MS;
      if (until > Date.now()) setCooldownUntil(until);
    }

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    if (!cooldownUntil) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [cooldownUntil]);

  // Resume a conversation saved to Firebase (see src/lib/firebase/chatSessions.ts)
  // from an earlier visit — e.g. after a cache clear/reload, which wipes the
  // in-memory state a same-tab reopen would otherwise preserve. Runs once
  // after mount so the default greeting is always what's SSR'd (no
  // hydration mismatch); a found session then replaces it.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await loadChatSession(getSessionId());
      if (cancelled || !saved) return;
      setStep(saved.step);
      setMessages(saved.messages);
      setSongName(saved.songName);
      setRequesterName(saved.requesterName);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist the resumable parts of the conversation after every change —
  // writes are infrequent (only on submit-style actions, not keystrokes,
  // since ChatInput keeps its own draft value locally) so no debouncing.
  useEffect(() => {
    saveChatSession(getSessionId(), { step, messages, songName, requesterName });
  }, [step, messages, songName, requesterName]);

  const cooldownSeconds = useMemo(() => {
    if (!cooldownUntil) return 0;
    return Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  }, [cooldownUntil, now]);

  const submitSong = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setSongName(trimmed);
    setMessages((prev) => [...prev, makeMessage("user", trimmed), makeMessage("bot", ASK_NAME)]);
    setStep("name");
  }, []);

  const submitName = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setRequesterName(trimmed);
    setMessages((prev) => [
      ...prev,
      makeMessage("user", trimmed),
      makeMessage("bot", CONFIRM_INTRO),
      makeMessage("bot", "", "request-preview"),
    ]);
    setStep("confirm");
  }, []);

  const startEdit = useCallback(() => setIsEditing(true), []);
  const cancelEdit = useCallback(() => setIsEditing(false), []);

  const saveEdit = useCallback((nextSongName: string, nextRequesterName: string) => {
    const song = nextSongName.trim();
    const name = nextRequesterName.trim();
    if (!song || !name) return;
    setSongName(song);
    setRequesterName(name);
    setIsEditing(false);
  }, []);

  const send = useCallback(async () => {
    if (submitLock.current) return;
    if (!navigator.onLine) {
      setErrorText(OFFLINE_ERROR);
      setStep("error");
      return;
    }

    submitLock.current = true;
    setErrorText(null);
    setStep("submitting");

    try {
      const response = await fetch("/api/song-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songName, requesterName, sessionId: getSessionId() }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        setErrorText(typeof data?.error === "string" ? data.error : GENERIC_ERROR);
        setStep("error");
        return;
      }

      const submittedAt = Date.now();
      window.localStorage.setItem(LAST_SUBMIT_KEY, String(submittedAt));
      setCooldownUntil(submittedAt + COOLDOWN_MS);
      setDuplicateNotice(Boolean(data.duplicate));
      setMessages((prev) => [
        ...prev,
        makeMessage(
          "bot",
          `Request sent successfully! \u{1F389} Thanks, ${requesterName}! Your request for \u{1F3B5} ${songName} has been received. We'll review it and consider adding it to Dhunzza.`
        ),
      ]);
      setStep("success");
    } catch {
      setErrorText(GENERIC_ERROR);
      setStep("error");
    } finally {
      submitLock.current = false;
    }
  }, [songName, requesterName]);

  const retry = useCallback(() => {
    setErrorText(null);
    setStep("confirm");
  }, []);

  const reset = useCallback(() => {
    setSongName("");
    setRequesterName("");
    setIsEditing(false);
    setErrorText(null);
    setDuplicateNotice(false);
    setMessages([makeMessage("bot", GREETING)]);
    setStep("song");
  }, []);

  return {
    step,
    messages,
    communityFeed,
    songName,
    requesterName,
    isEditing,
    errorText,
    duplicateNotice,
    cooldownSeconds,
    isOnline,
    submitSong,
    submitName,
    startEdit,
    cancelEdit,
    saveEdit,
    send,
    retry,
    reset,
  };
}

export type SongRequestChatState = ReturnType<typeof useSongRequestChat>;
