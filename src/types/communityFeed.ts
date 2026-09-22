/** A completed song request, broadcast live to every visitor currently on
 * the site — see src/lib/firebase/communityFeed.ts. Distinct from the
 * private, per-session ChatMessage type: these are never saved into a
 * user's own chatSessions/{sessionId} draft, only rendered live. */
export interface CommunityRequestEvent {
  id: string;
  songName: string;
  requesterName: string;
  createdAt: number;
}
