# Desi SongLOON

A 24/7 online radio station for 90s Hindi film music: 440 tracks across four themed channels that
never need a playlist to be picked.

## How it works

There is no background worker and no playback state on the server: `src/lib/scheduler.ts` derives
the day's running order from the current time alone, so the station is free to host on serverless
and immune to restarts. Each visit opens on a random track and then walks its own shuffled queue of
the channel, so no two visits play the same thing, and every song starts from its beginning.

`src/lib/station.ts` builds the four channels (Romantic, Dance Floor, Soulful, Retro Mix). Each is
seeded by its curated mood list; the rest of the library — resolved in untagged batches — is spread
across the four by a stable hash of the video id, so a song always lands on the same channel.

The running order itself is also reshuffled deterministically once per UTC day.

Audio comes from **official record-label uploads on YouTube**, embedded via the IFrame API. No audio
is hosted or re-encoded here, which keeps the project on the right side of music licensing — the
rights holders continue to monetise the plays. `src/components/YouTubePlayer.tsx` is wrapped behind a
small `PlayerHandle` interface so a licensed audio source can replace it later without touching the
station logic.

The page itself is deliberately bare — a slowly drifting retro photograph and the name of the song
currently on air. Backdrops live in `public/backdrops`, are shuffled per visit (skipping whichever
scene opened the previous visit) and cross-fade to the next one every 30 minutes. The player is
positioned offscreen and used for audio only.

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
`src/lib/station.ts` distributes every list across the four channels, deduplicated by video id.

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
