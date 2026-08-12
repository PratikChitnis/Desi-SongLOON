import { NextResponse } from "next/server";
import { nowPlaying } from "@/lib/scheduler";
import { station } from "@/lib/station";

export const dynamic = "force-dynamic";

/** Bounds `advance` so a client can't ask the station to run days ahead. */
const MAX_ADVANCE_SEC = 3600;

export function GET(request: Request) {
  const advance = Number(new URL(request.url).searchParams.get("advance")) || 0;
  const advanceSec = Math.min(Math.max(advance, 0), MAX_ADVANCE_SEC);

  const state = nowPlaying(station, Date.now() + advanceSec * 1000);

  return NextResponse.json(state, {
    headers: { "cache-control": "no-store" },
  });
}
