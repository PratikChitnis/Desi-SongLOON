import { NextResponse } from "next/server";
import { getStation, onAir } from "@/lib/radio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Current track JSON — the card, live widgets, and future features use this. */
export async function GET() {
  const station = await getStation();
  const air = onAir(station, Date.now());

  if (!air) {
    return NextResponse.json({ playing: false }, { status: 200 });
  }

  return NextResponse.json(
    {
      playing: true,
      station: {
        name: station.name,
        tagline: station.tagline,
      },
      track: {
        youtubeId: air.track.youtubeId,
        title: air.track.title,
        film: air.track.film || null,
        year: air.track.year || null,
        durationSec: air.track.durationSec,
      },
      index: air.index,
      total: air.total,
      offsetSec: air.offsetSec,
      at: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
