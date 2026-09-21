import { NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase/admin";
import { getClientIp, isRateLimited } from "@/lib/rateLimit";

const RATE_LIMIT = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * The only server route in the admin auth flow. The client sends its
 * Firebase ID token; this route verifies it server-side, checks the
 * decoded email against the server-only ADMIN_EMAILS allowlist, and — only
 * on a match — mints the `admin` custom claim. Every actual data mutation
 * (create category, upload/delete song) goes directly from the client to
 * Firestore/Storage afterward, gated by security rules that check this
 * claim, not by additional routes here.
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (isRateLimited(`bootstrap-claim:${ip}`, RATE_LIMIT, RATE_LIMIT_WINDOW_MS)) {
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

  const allowedEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  const email = decoded.email?.toLowerCase();
  const isAllowed = !!email && allowedEmails.includes(email);

  if (!isAllowed) {
    return NextResponse.json({ isAdmin: false });
  }

  if (decoded.admin !== true) {
    await adminAuth.setCustomUserClaims(decoded.uid, { admin: true });
  }

  return NextResponse.json({ isAdmin: true });
}
