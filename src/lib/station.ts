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
  const ytResults = await searchYouTube(apis.youtube.apiKey, ch.youtubeQuery, 50);

  let spTracks: Awaited<ReturnType<typeof searchSpotify>> = [];
  if (apis.spotify.clientId && apis.spotify.clientSecret) {
    try {
      spTracks = await searchSpotify(
        apis.spotify.clientId,
        apis.spotify.clientSecret,
        ch.spotifyQuery,
        50,
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
    .filter((v) => v.durationSec > 60) // skip shorts / clips
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

  return { id: ch.id, name: ch.name, tagline: ch.tagline, tracks };
}

/** Lowercase and strip common suffixes for fuzzy matching. */
function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(.*?\)/g, "")   // remove (official video) etc.
    .replace(/\[.*?\]/g, "")   // remove [hd] etc.
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

/**
 * Best-effort: if the YouTube title contains a pipe, the part after it is
 * often the film name (e.g. "Tujhe Dekha To — Yash Chopra Film").
 */
function extractFilmFromTitle(title: string): string {
  const pipe = title.indexOf("|");
  if (pipe !== -1) return title.slice(pipe + 1).trim();
  const dash = title.indexOf(" - ");
  if (dash !== -1) return title.slice(dash + 3).trim();
  return "";
}

/**
 * Fetch all channels in parallel.  Results are cached for 24 hours by the
 * individual API wrappers, so subsequent calls within the same serverless
 * invocation are free.
 */
export async function fetchAllChannels(): Promise<Station[]> {
  return Promise.all(channelDefs.map(buildChannel));
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
