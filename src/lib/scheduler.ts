import type { NowPlaying, Station, Track } from "./types";

/** Station epoch: the moment the schedule is measured from. */
export const STATION_EPOCH_MS = Date.UTC(2024, 0, 1);

const DAY_MS = 86_400_000;

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic per-day shuffle: everyone tuned in on the same UTC day hears
 * the same running order, but the order differs day to day.
 */
export function dailyOrder(tracks: Track[], stationId: string, atMs: number): Track[] {
  const day = Math.floor((atMs - STATION_EPOCH_MS) / DAY_MS);
  const rand = mulberry32(hash(`${stationId}:${day}`));
  const shuffled = [...tracks];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Which track the schedule has reached at `atMs`, by walking today's running
 * order. Used to pick the entry point for a listener tuning in; playback then
 * continues sequentially from the start of each track.
 */
function scheduledIndex(order: Track[], atMs: number): number {
  const totalSec = order.reduce((sum, t) => sum + t.durationSec, 0);
  const dayStart = STATION_EPOCH_MS + Math.floor((atMs - STATION_EPOCH_MS) / DAY_MS) * DAY_MS;
  let elapsed = Math.floor((atMs - dayStart) / 1000) % totalSec;

  let index = 0;
  while (elapsed >= order[index].durationSec) {
    elapsed -= order[index].durationSec;
    index = (index + 1) % order.length;
  }
  return index;
}

/**
 * Resolves a track from the day's running order. Without `index` the station
 * clock decides where a new listener joins; with one, the client is walking the
 * order itself so that every song plays from its beginning.
 */
export function nowPlaying(
  station: Station,
  index?: number,
  atMs: number = Date.now(),
): NowPlaying {
  if (station.tracks.length === 0) {
    throw new Error(`Station ${station.id} has no tracks`);
  }
  const order = dailyOrder(station.tracks, station.id, atMs);
  const at = index === undefined ? scheduledIndex(order, atMs) : index % order.length;

  return { track: order[at], index: at, total: order.length };
}
