import { NextResponse } from "next/server";
import { getClientIp, isRateLimited } from "@/lib/rateLimit";

const ACTIVE_WINDOW_MS = 30_000;
// Heartbeats fire every 15s client-side; this comfortably allows retries
// after a dropped connection without permitting a spam loop.
const RATE_LIMIT = 12;
const RATE_LIMIT_WINDOW_MS = 60_000;
// Hard ceiling on tracked sessions so a flood of distinct fake session IDs
// can't grow this in-memory map without bound between prune cycles.
const MAX_TRACKED_SESSIONS = 5000;
const SESSION_ID_PATTERN = /^[a-zA-Z0-9-]{1,64}$/;

declare global {
  // eslint-disable-next-line no-var
  var __dhunzzaPresence: Map<string, number> | undefined;
}

const sessions = globalThis.__dhunzzaPresence ?? new Map<string, number>();
globalThis.__dhunzzaPresence = sessions;

function pruneAndCount(): number {
  const now = Date.now();
  for (const [id, lastSeen] of sessions) {
    if (now - lastSeen > ACTIVE_WINDOW_MS) sessions.delete(id);
  }
  return sessions.size;
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (isRateLimited(`presence:${ip}`, RATE_LIMIT, RATE_LIMIT_WINDOW_MS)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : null;

  if (sessionId && SESSION_ID_PATTERN.test(sessionId) && sessions.size < MAX_TRACKED_SESSIONS) {
    sessions.set(sessionId, Date.now());
  }

  return NextResponse.json({ count: pruneAndCount() });
}

export async function GET() {
  return NextResponse.json({ count: pruneAndCount() });
}
