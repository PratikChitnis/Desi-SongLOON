# Desi SongLOON

A 24/7 online radio station for 90s Hindi film music: one continuous stream of 440 tracks that never
needs a playlist to be picked.

## How it works

The station is a **clock, not a queue**. There is no background worker and no playback state on the
server: `src/lib/scheduler.ts` derives the day's running order and how far the schedule has got from
the current time alone, so the station is free to host on serverless and immune to restarts. The
clock picks where a listener joins the order; playback then walks it sequentially, each song from
its beginning.

The running order is reshuffled deterministically once per UTC day, so the station doesn't sound
identical every morning.

Audio comes from **official record-label uploads on YouTube**, embedded via the IFrame API. No audio
is hosted or re-encoded here, which keeps the project on the right side of music licensing — the
rights holders continue to monetise the plays. `src/components/YouTubePlayer.tsx` is wrapped behind a
small `PlayerHandle` interface so a licensed audio source can replace it later without touching the
station logic.

The page itself is deliberately bare — a slowly drifting retro photograph and the name of the song
currently on air. Backdrops live in `public/backdrops` and are selected from the same clock, so they
change every four hours and match for everyone. The player is positioned offscreen and used for
audio only.

## Development

```bash
npm install
npm run dev        # http://localhost:3000
npm run build
npm run lint
```

## Playlists

Curated song lists live in `scripts/songs.json` (title / film / year — no video ids). To resolve them
into playable tracks:

```bash
npm run playlists:build              # all lists
npm run playlists:build romantic     # one list
```

The script searches YouTube, keeps only uploads from official label channels (T-Series, Saregama,
Tips, Sony Music India, Venus, Shemaroo, Zee Music, YRF …), and writes `src/data/<list>.json`.
`src/lib/station.ts` merges every list into the single station playlist, deduplicated by video id.

Videos do get pulled or region-locked over time, so verify periodically:

```bash
npm run playlists:check
```

It exits non-zero and names any track that no longer resolves. The player also skips a failing track
at runtime rather than stalling the station.

## Adding songs

1. Add them to any list in `scripts/songs.json`.
2. Run `npm run playlists:build <list-id>` to resolve them.

For a whole new list, add an entry with an `id`, `name`, `tagline` and songs, build it, then import
the generated JSON in `src/lib/station.ts`.

## Roadmap

See [PLAN.md](./PLAN.md).
