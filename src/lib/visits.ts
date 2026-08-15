import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import * as path from "node:path";

/**
 * Total unique-visitor counter, persisted to data/visits.json so it survives
 * server restarts.  A "visit" is a new device session id (the same id used by
 * the live listener feed), so one device is counted once ever.
 *
 * Note: like the listener count, this lives in the server instance's
 * filesystem.  On a single-instance host it is exact; across multiple
 * serverless instances you'd need a shared store (KV/Redis).
 */

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "visits.json");

interface VisitStore {
  total: number;
  seen: string[];
}

let store: VisitStore | null = null;
const seenIds = new Set<string>();
let writeQueue: Promise<void> = Promise.resolve();

function load(): VisitStore {
  if (store) return store;
  try {
    const raw = readFileSync(FILE, "utf8");
    const parsed = JSON.parse(raw) as VisitStore;
    store = { total: parsed.total || 0, seen: Array.isArray(parsed.seen) ? parsed.seen : [] };
  } catch {
    store = { total: 0, seen: [] };
  }
  for (const id of store.seen) seenIds.add(id);
  return store;
}

/** Queue a durable write (temp file + rename) so it's crash-safe-ish. */
function flush() {
  const data = store!;
  writeQueue = writeQueue.then(() => {
    try {
      mkdirSync(DATA_DIR, { recursive: true });
      const tmp = `${FILE}.tmp`;
      writeFileSync(tmp, JSON.stringify({ total: data.total, seen: data.seen }));
      renameSync(tmp, FILE);
    } catch {
      // best effort — in-memory total still counts
    }
  });
}

/** Register a visit from a device session id. Returns the new total. */
export function registerVisit(session: string): number {
  const s = load();
  if (!session || session === "anon") return s.total;
  if (seenIds.has(session)) return s.total;
  seenIds.add(session);
  s.seen.push(session);
  s.total += 1;
  flush();
  return s.total;
}

export function currentVisits(): number {
  return load().total;
}
