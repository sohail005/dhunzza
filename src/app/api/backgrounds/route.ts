import "server-only";
import { NextResponse } from "next/server";
import { getClientIp, isRateLimited } from "@/lib/rateLimit";
import { fetchOrGetCachedEraPhotoPool, VALID_ERAS } from "@/lib/backgroundPhotosServer";
import type { EraId } from "@/types/music";

const RATE_LIMIT = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;

export async function GET(request: Request) {
  const ip = getClientIp(request);
  if (isRateLimited(`backgrounds:${ip}`, RATE_LIMIT, RATE_LIMIT_WINDOW_MS)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const era = searchParams.get("era");
  if (!era || !VALID_ERAS.has(era as EraId)) {
    return NextResponse.json({ error: "Invalid or missing era." }, { status: 400 });
  }
  const validEra = era as EraId;

  try {
    const urls = await fetchOrGetCachedEraPhotoPool(validEra);
    return NextResponse.json({ urls });
  } catch {
    return NextResponse.json({ error: "Couldn't fetch background photos." }, { status: 502 });
  }
}
