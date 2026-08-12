import type { Channel, NowPlaying, Track } from "./types";

/** Station epoch: the moment every channel's schedule is measured from. */
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
 * Deterministic per-day shuffle: everyone tuned to a channel on the same UTC
 * day hears the same running order, but the order differs day to day.
 */
export function dailyOrder(tracks: Track[], channelId: string, atMs: number): Track[] {
  const day = Math.floor((atMs - STATION_EPOCH_MS) / DAY_MS);
  const rand = mulberry32(hash(`${channelId}:${day}`));
  const shuffled = [...tracks];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * The station is a clock, not a queue: the current track is derived from the
 * time elapsed since the station epoch, so the stream is stateless and every
 * listener is synchronised to the same position.
 */
export function nowPlaying(channel: Channel, atMs: number = Date.now(), upNextCount = 3): NowPlaying {
  if (channel.tracks.length === 0) {
    throw new Error(`Channel ${channel.id} has no tracks`);
  }
  const order = dailyOrder(channel.tracks, channel.id, atMs);
  const total = order.reduce((sum, t) => sum + t.durationSec, 0);

  const dayStart = STATION_EPOCH_MS + Math.floor((atMs - STATION_EPOCH_MS) / DAY_MS) * DAY_MS;
  let elapsed = Math.floor((atMs - dayStart) / 1000) % total;

  let index = 0;
  while (elapsed >= order[index].durationSec) {
    elapsed -= order[index].durationSec;
    index = (index + 1) % order.length;
  }

  const upNext = Array.from({ length: Math.min(upNextCount, order.length - 1) }, (_, i) => order[(index + i + 1) % order.length]);

  return {
    channel: channel.id,
    track: order[index],
    offsetSec: elapsed,
    remainingSec: order[index].durationSec - elapsed,
    serverTime: atMs,
    upNext,
  };
}
