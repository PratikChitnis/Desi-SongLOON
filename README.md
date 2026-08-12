# Desi SongLOON

A 24/7 online radio station for 90s Hindi film music. Four channels play continuously; every
listener who tunes in hears the same song at the same position, like a real broadcast.

## How it works

The station is a **clock, not a queue**. There is no background worker and no playback state on the
server: given a channel and the current time, `src/lib/scheduler.ts` derives which track is playing
and how far into it we are, by walking the day's playlist durations. That makes playback
synchronised across listeners, free to host on serverless, and immune to restarts.

The running order is reshuffled deterministically once per UTC day (seeded by channel + day), so the
station doesn't sound identical every morning.

Audio comes from **official record-label uploads on YouTube**, embedded via the IFrame API. No audio
is hosted or re-encoded here, which keeps the project on the right side of music licensing — the
rights holders continue to monetise the plays. `src/components/YouTubePlayer.tsx` is wrapped behind a
small `PlayerHandle` interface so a licensed audio source can replace it later without touching the
station logic.

The page itself is deliberately bare — a rotating animated retro backdrop and the name of the song
currently on air. Backdrops live in `src/lib/backdrops.ts` and are selected from the same clock, so
they change every two hours and match for everyone. The YouTube player stays on screen as a small
corner window because YouTube's terms don't allow hiding it.

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
npm run playlists:build              # all channels
npm run playlists:build romantic     # one channel
```

The script searches YouTube, keeps only uploads from official label channels (T-Series, Saregama,
Tips, Sony Music India, Venus, Shemaroo, Zee Music, YRF …), and writes `src/data/<channel>.json`.

Videos do get pulled or region-locked over time, so verify periodically:

```bash
npm run playlists:check
```

It exits non-zero and names any track that no longer resolves. The player also skips a failing track
at runtime rather than stalling the station.

## Adding a channel

1. Add an entry to `scripts/songs.json` with an `id`, `name`, `tagline` and songs.
2. Run `npm run playlists:build <id>`.
3. Import the new JSON in `src/lib/channels.ts` and add the id to `ChannelId` in `src/lib/types.ts`.

## Roadmap

See [PLAN.md](./PLAN.md).
