/**
 * Central configuration for Desi SongLOON.
 *
 * Every tunable value lives here so nothing is scattered across components.
 * For deployment, these can be swapped with env vars or a CMS without touching
 * component code.
 */

export const site = {
  title: "Desi SongLOON",
  tagline: "90s Bollywood, 24/7",
  description:
    "A round-the-clock radio station of 90s Hindi film music, synchronised for every listener.",
  ogDescription: "90s Bollywood radio, playing round the clock.",
  /** Public origin — used for absolute og:image URLs. Override when deployed. */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  contactEmail: "pratikppc12@gmail.com",
  lang: "en" as const,
} as const;

export const player: {
  defaultVolume: number;
  maxFailures: number;
  previousThresholdSec: number;
} = {
  /** Default volume on first visit (0-100). */
  defaultVolume: 70,
  /** Max consecutive playback failures before showing the hard error. */
  maxFailures: 3,
  /** Seconds into a track before "previous" restarts it instead of going back. */
  previousThresholdSec: 3,
};

export const scheduler = {
  /** Station epoch — changing this reshuffles every running order. */
  epochMs: Date.UTC(2024, 0, 1),
} as const;

export const metadata = {
  title: `${site.title} — ${site.tagline}`,
  description: site.description,
  ogTitle: site.title,
  ogDescription: site.ogDescription,
} as const;

export const apis = {
  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY ?? "",
    fallbackKey: process.env.YOUTUBE_API_KEY_FALLBACK ?? "",
    /** The station's curated 90s playlist — played as one continuous channel. */
    playlistId: process.env.YOUTUBE_PLAYLIST_ID ?? "",
  },
  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID ?? "",
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET ?? "",
  },
} as const;

export interface ChannelConfig {
  id: string;
  name: string;
  tagline: string;
  /** Spotify search query for metadata enrichment. */
  spotifyQuery: string;
}

export const channelDefs: ChannelConfig[] = [
  {
    id: "desi",
    name: site.title,
    tagline: site.tagline,
    spotifyQuery: "90s bollywood hits",
  },
];
