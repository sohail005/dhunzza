export type SongRequestStatus = "pending" | "reviewing" | "approved" | "rejected" | "added";

/** Public shape written by the chatbot. Server-controlled fields (createdAt,
 * status, source) are never accepted from the client — see
 * src/lib/firebase/songRequests.ts. */
export interface SongRequest {
  songName: string;
  requesterName: string;
  normalizedSongName: string;
  createdAt: number; // epoch ms, ServerValue.TIMESTAMP
  status: SongRequestStatus;
  source: "chatbot";
  userId: string | null;
  /** Anonymous chat session id (see chatSessions/{sessionId}) — lets an
   * admin upload that fulfills this request append a notification directly
   * into the requester's saved conversation. Never used to identify a
   * person; it's the same rate-limiting session id, immutable once set. */
  sessionId: string | null;
  /** Firestore song id, set once an admin upload fulfills this request. */
  songId: string | null;
  /** Epoch ms the request was last claimed/fulfilled by an admin — also
   * doubles as the claim timestamp while status is "reviewing", used to
   * detect and recover abandoned claims (see songRequestsAdmin.ts). */
  reviewedAt?: number | null;
  /** Admin email who claimed or fulfilled this request. */
  reviewedBy?: string | null;
}

/** Fields the client is allowed to submit. Everything else on SongRequest
 * (createdAt, status, source, userId, songId) is assigned server-side. */
export interface SongRequestInput {
  songName: string;
  requesterName: string;
  sessionId?: string | null;
}

export interface SongRequestResult {
  ok: boolean;
  requestId?: string;
  duplicate?: boolean;
  error?: string;
}
