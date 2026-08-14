import type { NowPlaying, Station, Track } from "./types";
import { scheduler } from "./config";

/** Station epoch: the moment the schedule is measured from. */
export const STATION_EPOCH_MS = scheduler.epochMs;

const DAY_MS = 86_400_000;

export function hash(seed: string): number {
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
 * Returns indices into the original tracks array.
 */
export function dailyOrder(tracks: Track[], stationId: string, atMs: number): number[] {
  const day = Math.floor((atMs - STATION_EPOCH_MS) / DAY_MS);
  const rand = mulberry32(hash(`${stationId}:${day}`));
  const indices = tracks.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}

/**
 * Resolves a track from the day's running order. Without `index` the entry
 * point is random, so no two visits open on the same song; with one, the client
 * is walking its own shuffled queue.
 */
export function nowPlaying(
  station: Station,
  index?: number,
  atMs: number = Date.now(),
): NowPlaying | null {
  if (station.tracks.length === 0) {
    return null;
  }
  const order = dailyOrder(station.tracks, station.id, atMs);
  const at = index === undefined ? Math.floor(Math.random() * order.length) : index % order.length;

  return { track: station.tracks[order[at]], index: at, total: order.length, order };
}
