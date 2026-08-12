import { NextResponse } from "next/server";
import { nowPlaying } from "@/lib/scheduler";
import { station } from "@/lib/station";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("index");
  const parsed = Number(raw);
  const index = raw !== null && Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;

  return NextResponse.json(nowPlaying(station, index), {
    headers: { "cache-control": "no-store" },
  });
}
