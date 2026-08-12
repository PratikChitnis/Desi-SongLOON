import { NextResponse } from "next/server";
import { getChannel } from "@/lib/channels";
import { nowPlaying } from "@/lib/scheduler";

export const dynamic = "force-dynamic";

/** Bounds `advance` so a client can't ask the station to run days ahead. */
const MAX_ADVANCE_SEC = 3600;

export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const advance = Number(params.get("advance")) || 0;
  const advanceSec = Math.min(Math.max(advance, 0), MAX_ADVANCE_SEC);

  const state = nowPlaying(getChannel(params.get("channel")), Date.now() + advanceSec * 1000);

  return NextResponse.json(state, {
    headers: { "cache-control": "no-store" },
  });
}
