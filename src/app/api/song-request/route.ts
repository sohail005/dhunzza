import { NextResponse } from "next/server";
import { getClientIp, isRateLimited } from "@/lib/rateLimit";
import { createSongRequest } from "@/lib/firebase/songRequests";

// Cooldown per browser session (client-supplied id, same pattern as
// /api/presence) — blocks rapid double-submits from the same tab.
const SESSION_LIMIT = 1;
const SESSION_WINDOW_MS = 45_000;
// Looser ceiling per IP so one bad actor cycling session ids can't flood
// the database even though the per-session cooldown resets each time.
const IP_LIMIT = 8;
const IP_WINDOW_MS = 10 * 60_000;

const SESSION_ID_PATTERN = /^[a-zA-Z0-9-]{1,64}$/;
const MAX_BODY_FIELD_LENGTH = 200;

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (isRateLimited(`song-request:ip:${ip}`, IP_LIMIT, IP_WINDOW_MS)) {
    return NextResponse.json(
      { ok: false, error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const songName = typeof body.songName === "string" ? body.songName.slice(0, MAX_BODY_FIELD_LENGTH) : "";
  const requesterName =
    typeof body.requesterName === "string" ? body.requesterName.slice(0, MAX_BODY_FIELD_LENGTH) : "";
  const rawSessionId = typeof body.sessionId === "string" ? body.sessionId : null;
  const sessionId = rawSessionId && SESSION_ID_PATTERN.test(rawSessionId) ? rawSessionId : null;

  if (sessionId) {
    if (isRateLimited(`song-request:session:${sessionId}`, SESSION_LIMIT, SESSION_WINDOW_MS)) {
      return NextResponse.json(
        { ok: false, error: "Please wait a moment before sending another request." },
        { status: 429 }
      );
    }
  }

  try {
    const result = await createSongRequest({ songName, requesterName, sessionId });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error ?? "Invalid request." }, { status: 400 });
    }
    return NextResponse.json({ ok: true, duplicate: result.duplicate ?? false });
  } catch (error) {
    // Technical details stay server-side; the client only ever sees a
    // generic message (see section 20 of the feature spec).
    console.error("song-request submission failed:", error);
    return NextResponse.json(
      { ok: false, error: "Something went wrong while sending your request." },
      { status: 500 }
    );
  }
}
