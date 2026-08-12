# Desi-SongLOON — Implementation Plan

A website streaming 90s Hindi/Bollywood music 24/7 (a continuous "radio station" in the browser).

## 0. The blocker to decide first: where does the audio come from?

You cannot legally host or stream commercial Bollywood recordings (T-Series, Saregama, Tips, Zee Music, Sony) without a license. Pick one path before any code is written:

| Option | How it works | Cost / effort | Legal |
|---|---|---|---|
| **A. YouTube IFrame embeds** | Curate a playlist of official label uploads; the site autoplays them one after another in an embedded player. You never store audio. | Free | Safe (label monetises via YouTube ads). Must keep the video visible-ish and follow YouTube ToS; no audio-only ripping. |
| **B. Spotify Web Playback SDK** | Users log in with their own Spotify Premium account; your site controls a curated 90s playlist. | Free | Safe. Downside: requires each listener to have Premium. |
| **C. Licensed catalogue API** (Saregama/Hungama/JioSaavn B2B) | Real 24/7 audio stream you control. | Paid, contract negotiation | Safe, but slow to obtain. |
| **D. Self-host MP3s + Icecast/Liquidsoap** | You run a true radio stream. | Cheap technically | **Not legal** for commercial Bollywood tracks without licensing + PRO royalties (IPRS/PPL India, or SoundExchange-equivalent). |

**Recommendation: start with A (YouTube embeds)** — it gets a working 24/7 station live fast and legally, with zero licensing cost. Architecture below keeps the player behind an interface so you can swap in B/C later without a rewrite.

## 1. Product scope (v1)

- Lands on a page that immediately starts playing (after one user click — browsers block autoplay with sound).
- "Always on" feel: a server-defined schedule means everyone who opens the site hears roughly the same track at the same offset, like real radio.
- Now-playing card: song, film, year, artist, artwork.
- Controls: play/pause, volume, skip (optional), "next up" preview.
- Channels: `90s Romantic`, `90s Dance/Party`, `Sad/Ghazal`, `Retro Remix`.
- Mobile-friendly, dark retro-cassette aesthetic.

Out of scope for v1: user accounts, requests, likes, chat, downloads.

## 2. Architecture

```
Next.js (App Router) on Vercel
├─ /                      landing + player (client component)
├─ /api/now-playing       returns { track, startedAt, offsetSec, next[] }
├─ lib/scheduler.ts       deterministic: given channel + Date.now(), compute
│                         current track + seek offset from playlist durations
└─ data/playlist.<ch>.json  curated tracks (youtubeId, title, film, year, durationSec)
```

- **Deterministic scheduler**, not a background job: the "station clock" is `elapsed = (now - epoch) % totalPlaylistDuration`; walk the playlist to find the current track and offset. Stateless, free to run, survives restarts, and makes every listener synchronised.
- Player wraps the YouTube IFrame API; on load it calls `/api/now-playing`, seeks to `offsetSec`, and on `ended` refetches. A pluggable `PlayerAdapter` interface (`load/play/pause/seek`) keeps Spotify/HLS swappable.
- Metadata/artwork: store in the playlist JSON (curated by hand or scraped once from YouTube Data API), so no per-request third-party calls.

## 3. Content curation

- Build the 90s playlist per channel (target ~150–300 tracks per channel ≈ 12–24h of unique audio before repeat).
- Only use **official label channel uploads** (T-Series, Saregama, Tips, Venus, Shemaroo) so embeds don't break and rights-holders get paid.
- A small script (`scripts/import-playlist.ts`) takes a YouTube playlist URL → fetches ids/titles/durations via the YouTube Data API → writes the JSON. Needs a `YOUTUBE_API_KEY`.
- A weekly check for videos gone private/region-blocked (embeddable flag) so dead tracks get pruned.

## 4. Build phases

1. **Phase 0 — decision** (you): confirm the YouTube-embed approach. Get a YouTube Data API key.
2. **Phase 1 — skeleton**: Next.js + TypeScript + Tailwind, deployed to Vercel, one hardcoded track playing.
3. **Phase 2 — scheduler + API**: playlist JSON, deterministic clock, `/api/now-playing`, synchronised playback with seek.
4. **Phase 3 — UI**: now-playing card, controls, channel switcher, retro theme, mobile layout.
5. **Phase 4 — content**: import script + curate the 4 channels; dead-link pruning.
6. **Phase 5 — polish**: SEO/OG tags, analytics (Plausible), error/offline states, keyboard shortcuts, share link.
7. **Phase 6 (optional)** — likes/requests, listener count, Spotify adapter, PWA.

Each phase is roughly one working session; phases 1–3 give a demoable 24/7 station.

## 5. Stack & cost

- Next.js 15 + TypeScript + Tailwind, deployed on Vercel free tier.
- No database in v1 (playlists are files in git). Add Postgres/Upstash only when requests/likes arrive.
- Domain: ~$10–15/yr. Everything else: $0.

## 6. Risks

- **Autoplay policy** — browsers require a user gesture; solve with a big "TUNE IN" button.
- **Embed breakage** — videos get pulled/region-locked; the pruning job plus a client-side "skip on error" handles it.
- **YouTube ToS** — must not hide the player entirely or strip ads; keep a visible (small) video surface.
- **Repetition** — shuffle deterministically per day so the schedule differs day to day.
