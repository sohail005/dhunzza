import { NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase/admin";
import { deleteSongRequestWithSideEffects } from "@/lib/firebase/songRequests";
import { getClientIp, isRateLimited } from "@/lib/rateLimit";

const RATE_LIMIT = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * Deletes a song request and its side effects (chat session, public feed
 * entry). Must be a server route, not a direct client RTDB call — the
 * public feed entry it also removes is write-blocked for clients entirely
 * (see database.rules.json), so only the Admin SDK can reach it.
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (isRateLimited(`delete-song-request:${ip}`, RATE_LIMIT, RATE_LIMIT_WINDOW_MS)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) {
    return NextResponse.json({ error: "Missing bearer token." }, { status: 401 });
  }

  const adminAuth = getAdminAuth();
  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: "Invalid token." }, { status: 401 });
  }

  if (decoded.admin !== true) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const requestId = typeof body?.requestId === "string" ? body.requestId : null;
  if (!requestId) {
    return NextResponse.json({ error: "Missing requestId." }, { status: 400 });
  }

  try {
    await deleteSongRequestWithSideEffects(requestId);
  } catch (error) {
    console.error("delete-song-request failed:", error);
    return NextResponse.json({ error: "Failed to delete request." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
