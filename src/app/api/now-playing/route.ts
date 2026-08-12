import { NextResponse } from "next/server";
import { getChannel } from "@/lib/channels";
import { nowPlaying } from "@/lib/scheduler";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const channelId = new URL(request.url).searchParams.get("channel");
  const state = nowPlaying(getChannel(channelId));

  return NextResponse.json(state, {
    headers: { "cache-control": "no-store" },
  });
}
