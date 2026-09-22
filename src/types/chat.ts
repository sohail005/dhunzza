export type ChatStep = "song" | "name" | "confirm" | "submitting" | "success" | "error";

export interface ChatMessage {
  id: string;
  role: "bot" | "user";
  content?: string;
  type?: "text" | "request-preview" | "song-added";
  /** Firestore song id — only set on "song-added" messages, drives the inline Play button. */
  songId?: string;
  timestamp: number;
}
