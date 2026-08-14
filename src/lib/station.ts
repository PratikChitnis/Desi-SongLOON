import type { Station, Track } from "./types";
import { searchYouTube } from "./youtube";
import { searchSpotify } from "./spotify";
import { apis, channelDefs, type ChannelConfig } from "./config";

/**
 * Build a Station by searching YouTube for the channel's query and enriching
 * results with Spotify metadata (film name, year).
 *
 * Falls back gracefully: if Spotify is unavailable, we use the YouTube title
 * as the track title and leave film/year as unknown.
 */
async function buildChannel(ch: ChannelConfig): Promise<Station> {
  let ytResults: Awaited<ReturnType<typeof searchYouTube>> = [];
  try {
    ytResults = await searchYouTube(apis.youtube.apiKey, ch.youtubeQuery, 200, apis.youtube.fallbackKey);
  } catch {
    // YouTube quota exceeded or API error — continue with empty results
  }

  let spTracks: Awaited<ReturnType<typeof searchSpotify>> = [];
  if (apis.spotify.clientId && apis.spotify.clientSecret) {
    try {
      spTracks = await searchSpotify(
        apis.spotify.clientId,
        apis.spotify.clientSecret,
        ch.spotifyQuery,
        100,
      );
    } catch {
      // Spotify is optional — continue with YouTube-only metadata
    }
  }

  // Build a lookup from Spotify: normalised title → album + year
  const spLookup = new Map<string, { album: string; year: number }>();
  for (const s of spTracks) {
    const key = normalise(s.name);
    spLookup.set(key, { album: s.album, year: s.year });
  }

  const tracks: Track[] = ytResults
    .filter((v) => v.durationSec >= 60 && v.durationSec <= 900) // 1–15 min: skip shorts, ads, compilations
    .map((v) => {
      const sp = spLookup.get(normalise(v.title));
      return {
        youtubeId: v.id,
        title: v.title,
        film: sp?.album ?? extractFilmFromTitle(v.title),
        year: sp?.year ?? 0,
        durationSec: v.durationSec,
      };
    });

  console.log(`[${ch.id}] Tracks loaded: ${tracks.length}`);

  return { id: ch.id, name: ch.name, tagline: ch.tagline, tracks };
}

/** Lowercase and strip common suffixes for fuzzy matching. */
function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(.*?\)/g, "")   // remove (official video) etc.
    .replace(/\[.*?\]/g, "")   // remove [hd] etc.
    .replace(/official\s*(video|audio|music\s*video)/g, "")
    .replace(/full\s*audio/g, "")
    .replace(/[\u0900-\u097F]+/g, "") // remove Hindi/Devanagari chars
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\btoh?\b/g, "to") // toh/to → to (common spelling variation)
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Best-effort: extract film name from YouTube title patterns like:
 *   "Song Name | Film Name"
 *   "Song Name - Film Name"
 *   "Song Name - Film Name (Official Video)"
 *   "Song Name | Film Name | Label"
 */
function extractFilmFromTitle(title: string): string {
  // Try pipe first (most common official format)
  const pipe = title.indexOf("|");
  if (pipe !== -1) {
    const after = title.slice(pipe + 1).trim();
    // If there's another pipe, take only the first segment
    const nextPipe = after.indexOf("|");
    return (nextPipe !== -1 ? after.slice(0, nextPipe) : after).trim();
  }
  // Try dash
  const dash = title.indexOf(" - ");
  if (dash !== -1) {
    const after = title.slice(dash + 3).trim();
    // Remove trailing parenthetical like (Official Video)
    return after.replace(/\s*\(.*?\)\s*$/, "").trim();
  }
  return "";
}

/**
 * Fetch all channels sequentially, deduplicating songs across channels.
 * Earlier channels in the list get priority for shared songs.
 */
export async function fetchAllChannels(): Promise<Station[]> {
  const usedIds = new Set<string>();
  const stations: Station[] = [];

  for (const ch of channelDefs) {
    const station = await buildChannel(ch);
    // Remove songs already used by previous channels
    station.tracks = station.tracks.filter((t) => {
      if (usedIds.has(t.youtubeId)) return false;
      usedIds.add(t.youtubeId);
      return true;
    });
    stations.push(station);
  }

  return stations;
}

/**
 * Fallback: if the API keys are missing, return empty channels so the UI
 * still renders (just with no tracks).
 */
export function emptyChannels(): Station[] {
  return channelDefs.map((ch) => ({
    id: ch.id,
    name: ch.name,
    tagline: ch.tagline,
    tracks: [],
  }));
}
