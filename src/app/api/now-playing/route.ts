import { NextResponse } from "next/server";
import { nowPlaying } from "@/lib/scheduler";
import { channelById } from "@/lib/station";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const raw = params.get("index");
  const parsed = Number(raw);
  const index = raw !== null && Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;

  return NextResponse.json(nowPlaying(channelById(params.get("channel")), index), {
    headers: { "cache-control": "no-store" },
  });
}
