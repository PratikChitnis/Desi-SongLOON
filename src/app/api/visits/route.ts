import type { NextRequest } from "next/server";
import { registerVisit, currentVisits } from "@/lib/visits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Total unique visitors.  GET /api/visits?session=<id> registers the device
 * (once ever) and returns the running total; without a session it just
 * reports the current total.  Used by the "total visits" readout.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const session = url.searchParams.get("session") ?? "";
  const registered = Boolean(session && session !== "anon");
  const total = registered ? registerVisit(session) : currentVisits();
  return Response.json({ total, registered, updatedAt: Date.now() });
}
