"use client";

import { get, ref as dbRef, remove as dbRemove, set as dbSet } from "firebase/database";
import { rtdb } from "@/lib/firebase/config";
import type { ChatMessage, ChatStep } from "@/types/chat";

const SESSIONS_PATH = "chatSessions";
// Resumable for a week, then treated as gone — mirrors the retention
// policy on the underlying song requests themselves (see EXPIRY_MS in
// src/lib/firebase/songRequests.ts).
const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
// Bounds the serialized payload well under the 8000-char field cap in
// database.rules.json — a resumable draft doesn't need unlimited history.
const MAX_STORED_MESSAGES = 30;

export interface ChatSessionState {
  step: ChatStep;
  messages: ChatMessage[];
  songName: string;
  requesterName: string;
}

const VALID_STEPS = new Set<ChatStep>(["song", "name", "confirm", "submitting", "success", "error"]);

function isValidMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Record<string, unknown>;
  return (
    typeof message.id === "string" &&
    (message.role === "bot" || message.role === "user") &&
    (message.content === undefined || typeof message.content === "string") &&
    (message.type === undefined ||
      message.type === "text" ||
      message.type === "request-preview" ||
      message.type === "song-added") &&
    (message.songId === undefined || typeof message.songId === "string") &&
    typeof message.timestamp === "number"
  );
}

/**
 * Loads a previously saved conversation for this browser session, if any
 * and not expired. Sessions are keyed by the same anonymous session id
 * already used for rate-limiting (see getSessionId in
 * src/hooks/useSongRequestChat.ts) — an unguessable UUID that acts as a
 * capability token, since there's no auth backing this anonymous chatbot.
 */
export async function loadChatSession(sessionId: string): Promise<ChatSessionState | null> {
  if (!sessionId) return null;

  try {
    const snapshot = await get(dbRef(rtdb, `${SESSIONS_PATH}/${sessionId}`));
    const value = snapshot.val() as
      | { step?: unknown; messagesJson?: unknown; songName?: unknown; requesterName?: unknown; updatedAt?: unknown }
      | null;
    if (!value) return null;

    if (typeof value.updatedAt !== "number" || Date.now() - value.updatedAt > EXPIRY_MS) {
      deleteChatSession(sessionId).catch(() => {});
      return null;
    }

    if (typeof value.step !== "string" || !VALID_STEPS.has(value.step as ChatStep)) return null;
    if (typeof value.messagesJson !== "string") return null;
    if (typeof value.songName !== "string" || typeof value.requesterName !== "string") return null;

    const parsed: unknown = JSON.parse(value.messagesJson);
    if (!Array.isArray(parsed) || !parsed.every(isValidMessage)) return null;

    return {
      step: value.step as ChatStep,
      messages: parsed,
      songName: value.songName,
      requesterName: value.requesterName,
    };
  } catch {
    // Corrupt data, offline, or the RTDB rules for chatSessions haven't
    // been deployed yet — resuming is a nice-to-have, fall back to a fresh
    // conversation rather than surfacing an error to the user.
    return null;
  }
}

export async function saveChatSession(sessionId: string, state: ChatSessionState): Promise<void> {
  if (!sessionId) return;
  const trimmedMessages = state.messages.slice(-MAX_STORED_MESSAGES);

  try {
    await dbSet(dbRef(rtdb, `${SESSIONS_PATH}/${sessionId}`), {
      step: state.step,
      messagesJson: JSON.stringify(trimmedMessages),
      songName: state.songName,
      requesterName: state.requesterName,
      updatedAt: Date.now(),
    });
  } catch {
    // Best-effort — the chat still works from in-memory state this tab
    // session even if the save fails (offline, rules not deployed yet).
  }
}

export async function deleteChatSession(sessionId: string): Promise<void> {
  if (!sessionId) return;
  await dbRemove(dbRef(rtdb, `${SESSIONS_PATH}/${sessionId}`)).catch(() => {});
}

/**
 * Appends a "your requested song is now on Dhunzza" message to a saved
 * conversation. Called from the admin upload flow (see
 * src/lib/firebase/songRequestFulfillment.ts) when an uploaded song matches
 * a pending request — the requester sees it as a normal chat message with a
 * Play button the next time they open the chat, without a separate
 * notification channel or polling endpoint.
 *
 * If the session has expired or was never saved (e.g. request submitted
 * before this feature existed, or the requester cleared their browser
 * data), this is a silent no-op — there's nothing to append to.
 */
export async function appendSongAddedMessage(
  sessionId: string,
  songName: string,
  songId: string
): Promise<void> {
  const existing = await loadChatSession(sessionId);
  if (!existing) return;

  const message: ChatMessage = {
    id: crypto.randomUUID(),
    role: "bot",
    content: songName,
    type: "song-added",
    songId,
    timestamp: Date.now(),
  };

  await saveChatSession(sessionId, {
    ...existing,
    messages: [...existing.messages, message],
  });
}
