# Desi SongLOON

A 24/7 online radio station for 90s Hindi film music, streaming via YouTube IFrame embeds across four themed channels.

## How it works

Songs are fetched dynamically from the **YouTube Data API v3** (search) and enriched with metadata from the **Spotify Web API** (film name, year). No songs are stored on disk — everything is fetched at runtime and cached for 24 hours.

`src/lib/scheduler.ts` derives the day's running order from the current time alone, so the station is free to host on serverless and immune to restarts. Each visit opens on a random track and walks its own shuffled queue, so no two visits play the same thing.

Audio comes from **official record-label uploads on YouTube**, embedded via the IFrame API. No audio is hosted or re-encoded here — rights holders continue to monetise the plays.

## API keys

Create a `.env.local` file:

```
YOUTUBE_API_KEY=your_key_here
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
```

**YouTube:** Get a key from [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → Create API key. Enable "YouTube Data API v3". Free tier: 10,000 units/day (we use ~400/day).

**Spotify:** Create an app at [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard/). Copy Client ID and Client Secret. Free tier covers our metadata needs.

## Development

```bash
npm install
npm run dev        # http://localhost:3000
npm run build
npm run lint
```

## Configuration

All tunable values live in `src/lib/config.ts`:

| Config | Purpose |
|---|---|
| `site.*` | Title, tagline, description, contact email |
| `player.*` | Default volume, failure threshold, skip-back gate |
| `scheduler.epochMs` | Station epoch for daily shuffle |
| `backdrops.*` | Rotation interval, cross-fade duration |
| `apis.*` | YouTube/Spotify API keys (from env) |
| `channelDefs` | Channel names, taglines, search queries |

## Architecture

```
src/lib/config.ts       → All tunable values + channel definitions
src/lib/cache.ts        → 24h in-memory TTL cache
src/lib/youtube.ts      → YouTube Data API v3 search wrapper
src/lib/spotify.ts      → Spotify Web API metadata enrichment
src/lib/station.ts      → Builds channels by fetching from APIs
src/lib/scheduler.ts    → Deterministic daily shuffle (no server state)
src/lib/backdrops.ts    → Background image rotation
src/components/         → React UI (Station, YouTubePlayer, Backdrop, VolumeControl)
```

## Roadmap

See [PLAN.md](./PLAN.md).
