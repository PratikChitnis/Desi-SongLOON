import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Live listener counter over Server-Sent Events.
 *
 * Every open page holds a streaming connection here.  A device counts as a
 * live listener only while it is actually playing: the client reports its
 * play/pause state via POST /api/listeners/state, and the count broadcast to
 * all clients is the number of sessions with `playing` true.  Responses are
 * immediate — pause drops the count, play brings it back, within one round
 * trip.
 *
 * The same endpoint returns a plain JSON snapshot when not requested as
 * text/event-stream, e.g. GET /api/listeners.
 *
 * Note: the count is per server instance.  On a single-instance host (one
 * `next start` / node process) it is exact; across multiple instances you
 * would need a shared store (KV/Redis) to aggregate.
 */

interface Listener {
  controller: ReadableStreamDefaultController<Uint8Array>;
  playing: boolean;
  lastSeen: number;
}

const listeners = new Map<string, Listener>();
let keepalive: ReturnType<typeof setInterval> | null = null;

const KEEPALIVE_MS = 15_000;
const STALE_MS = 90_000;

function encode(payload: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

/** Number of sessions that are actually playing right now. */
function liveCount(): number {
  let n = 0;
  for (const l of listeners.values()) {
    if (l.playing) n++;
  }
  return n;
}

/** Send the current count to every live connection. */
function broadcast() {
  const count = liveCount();
  const now = Date.now();
  for (const [id, l] of listeners) {
    try {
      l.controller.enqueue(encode({ count }));
      l.lastSeen = now;
    } catch {
      listeners.delete(id);
    }
  }
}

/** Every 15s re-broadcast keeps counts fresh and connections alive. */
function ensureKeepalive() {
  if (keepalive) return;
  keepalive = setInterval(() => {
    const now = Date.now();
    for (const [id, l] of listeners) {
      if (now - l.lastSeen > STALE_MS) {
        try {
          l.controller.close();
        } catch {
          // already closed
        }
        listeners.delete(id);
      }
    }
    broadcast();
  }, KEEPALIVE_MS);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const session = url.searchParams.get("session") || "anon";
  const accept = req.headers.get("accept") ?? "";

  // Plain JSON snapshot for monitoring.
  if (!accept.includes("text/event-stream")) {
    return Response.json({ count: liveCount(), updatedAt: Date.now() });
  }

  let current: ReadableStreamDefaultController<Uint8Array> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      current = controller;
      // A device (same localStorage session id) reconnecting replaces its old
      // connection, so one device always counts as at most one listener.
      const prev = listeners.get(session);
      if (prev) {
        try {
          prev.controller.close();
        } catch {
          // already closed — fine
        }
      }
      // Assume listening until the client reports its real state.
      listeners.set(session, { controller, playing: true, lastSeen: Date.now() });
      controller.enqueue(encode({ count: liveCount() }));
      ensureKeepalive();
    },
    cancel() {
      if (current && listeners.get(session)?.controller === current) {
        listeners.delete(session);
        broadcast();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

/** Client reports whether it is currently playing; updates the live count. */
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const session = url.searchParams.get("session") ?? "";
  const playing = url.searchParams.get("playing") === "1";
  const l = session ? listeners.get(session) : undefined;
  if (l) {
    l.playing = playing;
    l.lastSeen = Date.now();
    broadcast();
  }
  return Response.json({ ok: true, count: liveCount() });
}
