"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage, ChatStep } from "@/types/chat";
import type { CommunityRequestEvent } from "@/types/communityFeed";
import { loadChatSession, saveChatSession, subscribeToChatSession } from "@/lib/firebase/chatSessions";
import { subscribeToCommunityFeed } from "@/lib/firebase/communityFeed";

const SESSION_KEY = "dhunzza.session-id";
const LAST_SUBMIT_KEY = "dhunzza.song-request.last-submit";
// Client-side mirror of the server cooldown (see SESSION_WINDOW_MS in
// src/app/api/song-request/route.ts) — purely for UX so the button
// disables itself instantly instead of waiting on a 429 round-trip.
const COOLDOWN_MS = 45_000;

const GREETING = "Hey! \u{1F44B} Make Dhunzza better with us! Tell us your name and the song you want to hear. Your request could be our next addition!";
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
  const [step, setStep] = useState<ChatStep>("form");
  const [messages, setMessages] = useState<ChatMessage[]>(() => [makeMessage("bot", GREETING)]);
  const [songName, setSongName] = useState("");
  const [requesterName, setRequesterName] = useState("");
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
      // A resumed "submitting" step means the tab closed mid-request —
      // there's no in-flight promise to reattach to, so land back on the
      // form rather than getting stuck on a permanent spinner.
      setStep(saved.step === "submitting" ? "form" : saved.step);
      setMessages(saved.messages);
      setSongName(saved.songName);
      setRequesterName(saved.requesterName);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Live-merges messages an admin appends server-side (e.g. a "song added"
  // notification — see appendSongAddedMessage) into an already-open chat.
  // Only ever adds messages this tab doesn't already know about; step/song/
  // name stay locally driven so a concurrent remote write can't yank the
  // visitor out of whatever they're doing mid-conversation.
  useEffect(() => {
    const sessionId = getSessionId();
    if (!sessionId) return;
    return subscribeToChatSession(sessionId, (remote) => {
      if (!remote) return;
      setMessages((prev) => {
        const knownIds = new Set(prev.map((message) => message.id));
        const newOnes = remote.messages.filter((message) => !knownIds.has(message.id));
        if (newOnes.length === 0) return prev;
        return [...prev, ...newOnes].sort((a, b) => a.timestamp - b.timestamp);
      });
    });
  }, []);

  // Persist the resumable parts of the conversation after every change —
  // writes are infrequent (only on submit-style actions, not keystrokes,
  // since the form keeps its own draft values locally) so no debouncing.
  useEffect(() => {
    saveChatSession(getSessionId(), { step, messages, songName, requesterName });
  }, [step, messages, songName, requesterName]);

  const cooldownSeconds = useMemo(() => {
    if (!cooldownUntil) return 0;
    return Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  }, [cooldownUntil, now]);

  const send = useCallback(async (song: string, name: string) => {
    if (submitLock.current) return;
    if (!navigator.onLine) {
      setErrorText(OFFLINE_ERROR);
      setStep("error");
      return;
    }

    submitLock.current = true;
    setErrorText(null);
    setSongName(song);
    setRequesterName(name);
    setMessages((prev) => [...prev, makeMessage("bot", "", "request-preview")]);
    setStep("submitting");

    try {
      const response = await fetch("/api/song-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songName: song, requesterName: name, sessionId: getSessionId() }),
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
          `Request sent successfully! \u{1F389} Thanks, ${name}! Your request for \u{1F3B5} ${song} has been received. We'll review it and consider adding it to Dhunzza.`
        ),
      ]);
      setStep("success");
    } catch {
      setErrorText(GENERIC_ERROR);
      setStep("error");
    } finally {
      submitLock.current = false;
    }
  }, []);

  const retry = useCallback(() => {
    setErrorText(null);
    // Drop the request-preview bubble pushed just before the failed attempt
    // so retrying from the form doesn't leave a stale duplicate behind.
    setMessages((prev) => prev.filter((message) => message.type !== "request-preview"));
    setStep("form");
  }, []);

  const reset = useCallback(() => {
    setSongName("");
    setRequesterName("");
    setErrorText(null);
    setDuplicateNotice(false);
    setMessages([makeMessage("bot", GREETING)]);
    setStep("form");
  }, []);

  return {
    step,
    messages,
    communityFeed,
    songName,
    requesterName,
    errorText,
    duplicateNotice,
    cooldownSeconds,
    isOnline,
    send,
    retry,
    reset,
  };
}

export type SongRequestChatState = ReturnType<typeof useSongRequestChat>;
