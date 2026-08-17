# Desi SongLOON

A 24/7 online radio station for 90s Hindi film music, streaming via a curated YouTube playlist.

## How it works

Songs are pulled from a **curated YouTube playlist** and enriched with metadata from the **Spotify Web API** (film name, year). Non-90s content (regional, modern) is filtered out automatically.

`src/lib/scheduler.ts` derives the day's running order from the current time alone, so the station is free to host on serverless and immune to restarts. Each visit opens on a random track and walks its own shuffled queue — every song plays once before any repeat.

Audio comes from **official record-label uploads on YouTube**, embedded via the IFrame API. No audio is hosted or re-encoded — rights holders continue to monetise the plays.

## Features

- **Live listener count** — real-time concurrent listeners via SSE
- **Visit counter** — persistent unique-visitor tracking
- **OG image generation** — dynamic social preview with track info + LIVE badge
- **Equalizer animation** — visual bars that bounce when playing
- **Neon border** — spinning gradient ring around the now-playing card
- **Up Next queue** — shows upcoming tracks
- **Smart pause** — distinguishes user pause from video-switch pause
- **API key fallback** — automatic failover to second YouTube key on quota exhaustion
- **Mobile responsive** — optimized layout for all screen sizes

## Environment variables

Create a `.env.local` file:

```
YOUTUBE_API_KEY=your_key_here
YOUTUBE_API_KEY_FALLBACK=your_fallback_key
YOUTUBE_PLAYLIST_ID=your_playlist_id
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

**YouTube:** Get a key from [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials. Enable "YouTube Data API v3". Free tier: 10,000 units/day.

**Spotify:** Create an app at [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard/). Copy Client ID and Client Secret.

## Development

```bash
npm install
npm run dev        # http://localhost:3000
npm run build
npm run lint
npm run typecheck
```

## Configuration

All tunable values live in `src/lib/config.ts`:

| Config | Purpose |
|---|---|
| `site.*` | Title, tagline, description, contact email |
| `player.*` | Default volume, failure threshold, skip-back gate |
| `scheduler.epochMs` | Station epoch for daily shuffle |
| `apis.*` | YouTube/Spotify API keys (from env) |

## Architecture

```
src/lib/config.ts       → All tunable values
src/lib/cache.ts        → 24h in-memory TTL cache
src/lib/youtube.ts      → YouTube Data API v3 (playlist + search)
src/lib/spotify.ts      → Spotify Web API metadata enrichment
src/lib/station.ts      → Builds station from playlist + filters non-90s
src/lib/scheduler.ts    → Deterministic daily shuffle (no server state)
src/lib/radio.ts        → Real-time "on air" resolver
src/lib/non90s.ts       → Non-90s content filter
src/lib/visits.ts       → Persistent visitor counter
src/lib/backdrops.ts    → Background image config
src/components/         → React UI (Station, YouTubePlayer, Backdrop, VolumeControl)
src/app/api/            → API routes (now-playing, listeners, visits, OG image)
scripts/                → Playlist sync tool
```

## License

All music is the property of their respective owners. No copyright infringement intended.
