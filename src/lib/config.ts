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

export const backdrops = {
  /** Minutes between background image rotations. */
  rotateMinutes: 30,
  /** Cross-fade transition duration in milliseconds. */
  crossFadeMs: 2500,
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
  /** YouTube search query to populate this channel. */
  youtubeQuery: string;
  /** Spotify search query for metadata enrichment. */
  spotifyQuery: string;
}

export const channelDefs: ChannelConfig[] = [
  {
    id: "romantic",
    name: "90s Romantic",
    tagline: "Melodies from the golden age of Bollywood romance",
    youtubeQuery: "90s Hindi romantic songs official playlist",
    spotifyQuery: "90s bollywood romantic",
  },
  {
    id: "dance",
    name: "Dance Floor",
    tagline: "Big beats from the 90s dance floor",
    youtubeQuery: "90s Bollywood dance hits official",
    spotifyQuery: "90s bollywood dance",
  },
  {
    id: "soulful",
    name: "Soulful",
    tagline: "Slow, aching and unforgettable",
    youtubeQuery: "90s Hindi sad songs official",
    spotifyQuery: "90s bollywood sad",
  },
  {
    id: "retro-mix",
    name: "Retro Mix",
    tagline: "Everything else the decade had on repeat",
    youtubeQuery: "90s Hindi songs mix official",
    spotifyQuery: "90s bollywood hits",
  },
];
