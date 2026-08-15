import type { Station, Track } from "./types";
import { dailyOrder, STATION_EPOCH_MS } from "./scheduler";
import { fetchAllChannels } from "./station";
import { cached } from "./cache";

const DAY_MS = 86_400_000;

export interface OnAir {
  track: Track;
  /** Position of the track in today's running order. */
  index: number;
  /** Number of tracks in today's running order. */
  total: number;
  /** Seconds since this track started playing. */
  offsetSec: number;
}

/**
 * The single station for the app (channels have been collapsed to one).
 * Cached in memory so the page and the now-playing APIs share one build.
 */
export function getStation(): Promise<Station> {
  return cached("station:desi", DAY_MS, async () => {
    const channels = await fetchAllChannels();
    return channels[0];
  });
}

/**
 * Resolve what is "on air" at a given moment, like a real radio station:
 * the day's deterministic running order is walked from the start of the day,
 * accumulating each track's duration, so every listener hears the same song
 * at the same time.  Returns null when the station has no tracks.
 */
export function onAir(station: Station, atMs: number): OnAir | null {
  if (station.tracks.length === 0) return null;

  const order = dailyOrder(station.tracks, station.id, atMs);
  const day = Math.floor((atMs - STATION_EPOCH_MS) / DAY_MS);
  const dayStart = STATION_EPOCH_MS + day * DAY_MS;
  let elapsed = Math.max(0, (atMs - dayStart) / 1000);

  for (let i = 0; i < order.length; i++) {
    const track = station.tracks[order[i]];
    const duration = Math.max(track.durationSec, 1);
    if (elapsed < duration || i === order.length - 1) {
      return {
        track,
        index: i,
        total: order.length,
        offsetSec: Math.min(elapsed, duration),
      };
    }
    elapsed -= duration;
  }
  return null;
}
