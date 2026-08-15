/**
 * Sync songs from one or more public YouTube playlists into your own playlist.
 *
 * Usage:
 *   npx tsx scripts/sync-playlist.ts [--dry-run] [--limit N]
 *   npx tsx scripts/sync-playlist.ts --dedupe [--dry-run]   (remove exact duplicates)
 *
 * Reads every source playlist listed below, collects the video ids that are NOT
 * already in your destination playlist, and adds them (in order) via the
 * YouTube Data API using OAuth 2.0.
 *
 * Requirements:
 *   1. YOUTUBE_API_KEY in .env.local (for reading public playlists).
 *   2. An OAuth client id/secret (Desktop app) from Google Cloud Console
 *      with "YouTube Data API v3" enabled. Set GOOGLE_CLIENT_ID and
 *      GOOGLE_CLIENT_SECRET in .env.local.
 *   3. On first run a browser window opens — sign in with the account that owns
 *      the destination playlist and approve. The refresh token is stored in
 *      scripts/.yt-token.json (gitignored) for later runs.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import { exec, execFile } from "node:child_process";
import * as path from "node:path";
import * as os from "node:os";
import { isNon90s } from "../src/lib/non90s";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Your playlist — new songs are added here. */
const DEST_PLAYLIST_ID =
  process.env.YOUTUBE_PLAYLIST_ID ?? "PL7E6RBJ3R2ay6WkbHxhwhhNE2QiFvROpm";

/** Public playlists whose songs are copied into DEST_PLAYLIST_ID. */
const SOURCE_PLAYLIST_IDS = [
  "PLMRKdK25AuPVjHl9Kdb-gkBy0Cm7Zi2xo",
  "RDCLAK5uy_kiDNaS5nAXxdzsqFElFKKKs0GUEFJE26w",
  "PLAFjPVdERAkt7jNU1XW7EWXHLyYyf7Sux",
  "PLo7WLtfSrhdbdR4K_EQzplNiDYZMFk8jQ",
  "PLMRKdK25AuPUDFiPnyjeIQ3Wk7TuQyWSf",
  "PLHNOeF1Yw3i0Swt9LUXe5azHLMDn7V-ng",
  "PLoBdg15_smAAZL0QBG7G7Hkp0W0p4pk5f",
  "PLtfACaHtBsUB23A0-7xTv-uQbBDLbSVf1",
  "PL_wLKwe2BLzfuZbtCkyOx35kK8Y7l06Ta",
];

const API_BASE = "https://www.googleapis.com/youtube/v3";
const TOKEN_FILE = path.join(__dirname, ".yt-token.json");

/** 30s per request — a stalled call fails instead of hanging forever. */
const FETCH_TIMEOUT_MS = 30_000;

/** fetch() with an abort timeout. */
async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
const args = process.argv.slice(2);

const DRY_RUN = args.includes("--dry-run");
const DEDUPE = args.includes("--dedupe");
const AUDIT = args.includes("--audit");
const CLEAN = args.includes("--clean");
const LIMIT_ARG = args.find((a) => a.startsWith("--limit="));
const LIMIT = LIMIT_ARG ? Number(LIMIT_ARG.split("=")[1]) : Infinity;

// ---------------------------------------------------------------------------
// .env.local loader (no extra deps)
// ---------------------------------------------------------------------------

function loadEnv(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {};
  try {
    const raw = readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // .env.local missing — rely on process.env
  }
  return { ...env, ...process.env };
}

const env = loadEnv();
const API_KEY = env.YOUTUBE_API_KEY;
const CLIENT_ID = env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET;

const SCOPES = "https://www.googleapis.com/auth/youtube.force-ssl";

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetchWithTimeout(url, init);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube API error (${res.status}): ${body.slice(0, 500)}`);
  }
  return res.json() as Promise<T>;
}

interface PlaylistItemPage {
  items?: {
    id?: string;
    snippet: { resourceId: { videoId: string }; title: string };
  }[];
  nextPageToken?: string;
}

/** A song in a playlist, with the playlist-item ID (needed for deletion). */
interface PlaylistItem {
  itemId: string;
  videoId: string;
  title: string;
}

/** Walk a playlist and collect { itemId, videoId, title } triples.
 *  Public playlists are read with the API key; your own (private) playlists
 *  need an OAuth access token. */
async function readPlaylist(
  playlistId: string,
  accessToken?: string,
): Promise<PlaylistItem[]> {
  const out: PlaylistItem[] = [];
  let pageToken: string | undefined;
  const seenTokens = new Set<string>();
  // Cap at 200 pages (10,000 items) so a pathological/looping mix playlist
  // can't run forever.
  for (let pageNum = 0; pageNum < 200; pageNum++) {
    if (pageToken !== undefined) {
      if (seenTokens.has(pageToken)) {
        console.log(`  (playlist ${playlistId.slice(0, 8)}: loop detected, stopping at ${out.length} items)`);
        break;
      }
      seenTokens.add(pageToken);
    }
    const url = new URL(`${API_BASE}/playlistItems`);
    url.searchParams.set("part", "snippet");
    url.searchParams.set("playlistId", playlistId);
    url.searchParams.set("maxResults", "50");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    if (accessToken) {
      // OAuth token lets us read your own private playlists.
    } else {
      url.searchParams.set("key", API_KEY!);
    }

    const res = await fetchWithTimeout(url.toString(), {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`YouTube API error (${res.status}): ${body.slice(0, 500)}`);
    }
    const page = (await res.json()) as PlaylistItemPage;
    for (const item of page.items ?? []) {
      const vid = item.snippet?.resourceId?.videoId;
      const title = item.snippet?.title ?? "";
      // Skip deleted/private placeholders — they can't be inserted.
      if (!vid || title === "Private video" || title === "Deleted video") continue;
      out.push({ itemId: item.id ?? "", videoId: vid, title: title || vid });
    }
    pageToken = page.nextPageToken;
    if (!pageToken) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// OAuth 2.0 (loopback flow) — needed only to write to the playlist
// ---------------------------------------------------------------------------

interface TokenStore {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

function loadToken(): TokenStore | null {
  try {
    return JSON.parse(readFileSync(TOKEN_FILE, "utf8"));
  } catch {
    return null;
  }
}

function saveToken(t: TokenStore) {
  writeFileSync(TOKEN_FILE, JSON.stringify(t, null, 2), { mode: 0o600 });
}

async function refreshAccessToken(refresh: string): Promise<TokenStore> {
  const body = new URLSearchParams({
    client_id: CLIENT_ID!,
    client_secret: CLIENT_SECRET!,
    refresh_token: refresh,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Token refresh failed (${res.status})`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  return {
    access_token: data.access_token,
    refresh_token: refresh,
    expires_at: Date.now() + (data.expires_in - 60) * 1000,
  };
}

function openBrowser(url: string) {
  if (process.platform === "win32") {
    // rundll32 opens the URL via the OS default browser without any cmd
    // parsing, so the & characters in the URL are never touched.
    execFile("rundll32", ["url.dll,FileProtocolHandler", url], () => {});
  } else if (process.platform === "darwin") {
    exec(`open "${url}"`, () => {});
  } else {
    exec(`xdg-open "${url}"`, () => {});
  }
}

async function authorize(): Promise<TokenStore> {
  const redirectPort = 34567;
  const redirectUri = `http://localhost:${redirectPort}`;

  const code = await new Promise<string>((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", redirectUri);
      const codeParam = url.searchParams.get("code");
      const error = url.searchParams.get("error");
      if (codeParam || error) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(
          "<html><body style='font-family:sans-serif;text-align:center;margin-top:20vh'>" +
            "<h2>Done! You can close this tab and return to the terminal.</h2></body></html>",
        );
        server.close();
        if (codeParam) resolve(codeParam);
        else reject(new Error(`OAuth denied: ${error}`));
      }
    });
    server.listen(redirectPort, () => {
      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", CLIENT_ID!);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", SCOPES);
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("prompt", "consent");
      console.log("\nOpening your browser for Google sign-in...");
      console.log(`If it does not open, copy this URL into your browser:\n${authUrl}\n`);
      openBrowser(authUrl.toString());
    });
    server.on("error", reject);
  });

  const body = new URLSearchParams({
    client_id: CLIENT_ID!,
    client_secret: CLIENT_SECRET!,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Token exchange failed (${res.status})`);
  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  if (!data.refresh_token) {
    throw new Error(
      "No refresh token returned. Delete scripts/.yt-token.json and run again, " +
        "revoking the app in your Google account first.",
    );
  }
  const token: TokenStore = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in - 60) * 1000,
  };
  saveToken(token);
  return token;
}

async function getAccessToken(): Promise<string> {
  let token = loadToken();
  if (!token) {
    token = await authorize();
  } else if (Date.now() >= token.expires_at) {
    token = await refreshAccessToken(token.refresh_token);
    saveToken(token);
  }
  return token.access_token;
}

// ---------------------------------------------------------------------------
// Writing to the playlist
// ---------------------------------------------------------------------------

interface InsertResponse {
  id: string;
}

async function insertSong(playlistId: string, videoId: string, accessToken: string): Promise<void> {
  const url = new URL(`${API_BASE}/playlistItems`);
  url.searchParams.set("part", "snippet");
  await api<InsertResponse>(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      snippet: {
        playlistId,
        resourceId: { kind: "youtube#video", videoId },
      },
    }),
  });
}

/** Remove a single playlist item (same 50-unit cost as an insert). */
async function deleteSong(itemId: string, accessToken: string): Promise<void> {
  const url = new URL(`${API_BASE}/playlistItems/${itemId}`);
  await api<void>(url.toString(), {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/** Normalise a title so "Song | Film" and "Song - Film" match, and case/
 *  punctuation differences are ignored. */
function normaliseTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(.*?\)/g, "") // (official video), (lyrical), etc.
    .replace(/\[.*?\]/g, "")
    .replace(/[\u0900-\u097F]+/g, "") // strip Devanagari
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  if (!API_KEY) throw new Error("YOUTUBE_API_KEY is missing in .env.local");

  // Audit is read-only and the destination playlist is public, so it can run
  // with just the API key.  Clean, dedupe and sync all write to the playlist
  // and therefore need OAuth.
  const needsOAuth = !AUDIT;
  if (needsOAuth && (!CLIENT_ID || !CLIENT_SECRET)) {
    throw new Error(
      "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET missing. Create an OAuth Desktop client " +
        "at https://console.cloud.google.com/apis/credentials and add them to .env.local.",
    );
  }

  // Your playlist may be private, so read it (and write it) via OAuth.
  if (needsOAuth) {
    console.log("Authenticating...");
  }
  const accessToken = needsOAuth ? await getAccessToken() : undefined;
  console.log("Reading your playlist...");
  const mySongs = await readPlaylist(DEST_PLAYLIST_ID, accessToken);
  console.log(`  ${mySongs.length} songs already in playlist`);

  // --audit / --clean: find songs that don't belong (non-90s, regional), and
  // optionally remove them.
  if (AUDIT || CLEAN) {
    const toRemove = mySongs.filter((s) => isNon90s(s.title));
    console.log(`\n${toRemove.length} song(s) match the non-90s filter:`);
    for (const s of toRemove) {
      console.log(`  - ${s.title}`);
    }
    if (!CLEAN) {
      console.log("\nAudit only — rerun with --clean to remove them.");
      return;
    }
    if (DRY_RUN) {
      console.log("\nDry run — no changes made.");
      return;
    }
    if (!accessToken) {
      throw new Error("--clean needs OAuth access to your playlist. Check GOOGLE_CLIENT_ID/SECRET.");
    }
    let ok = 0;
    for (const s of toRemove) {
      if (!s.itemId) {
        console.error(`  ✗ cannot remove "${s.title}" — no playlist item ID returned (private/deleted?).`);
        continue;
      }
      try {
        await deleteSong(s.itemId, accessToken);
        ok++;
      } catch (e) {
        console.error(`  ✗ failed to remove "${s.title}": ${(e as Error).message}`);
      }
    }
    console.log(`\nDone. Removed ${ok} song(s).`);
    return;
  }

  // --dedupe: remove exact video-ID duplicates already in the playlist.
  if (DEDUPE) {
    const seen = new Set<string>();
    const toDelete: PlaylistItem[] = [];
    for (const s of mySongs) {
      if (seen.has(s.videoId)) toDelete.push(s);
      else seen.add(s.videoId);
    }
    console.log(`Found ${toDelete.length} duplicate(s) to remove.`);
    for (const s of toDelete) {
      console.log(`  - ${s.title}`);
    }
    if (toDelete.length === 0) {
      console.log("Playlist is already duplicate-free. Bye!");
      return;
    }
    if (DRY_RUN) {
      console.log("\nDry run — no changes made.");
      return;
    }
    if (!accessToken) {
      throw new Error("--dedupe needs OAuth access to your playlist. Check GOOGLE_CLIENT_ID/SECRET.");
    }
    let ok = 0;
    for (const s of toDelete) {
      if (!s.itemId) {
        console.error(`  ✗ cannot remove "${s.title}" — no playlist item ID returned (private/deleted?).`);
        continue;
      }
      try {
        await deleteSong(s.itemId, accessToken);
        ok++;
      } catch (e) {
        console.error(`  ✗ failed to remove "${s.title}": ${(e as Error).message}`);
        console.error(`    (target: ${API_BASE}/playlistItems/${s.itemId})`);
      }
    }
    console.log(`\nDone. Removed ${ok} duplicate(s).`);
    return;
  }

  const toAdd: { videoId: string; title: string; source: string }[] = [];
  // Skip if the same video — or the same song title — is already present.
  const seenIds = new Set(mySongs.map((x) => x.videoId));
  const seenTitles = new Set(mySongs.map((x) => normaliseTitle(x.title)));

  let titleDuplicates = 0;
  let filteredOut = 0;

  for (const pid of SOURCE_PLAYLIST_IDS) {
    console.log(`Reading source playlist ${pid.slice(0, 8)}…`);
    let songs: PlaylistItem[];
    try {
      songs = await readPlaylist(pid);
    } catch {
      // Private or restricted — fall back to OAuth.
      songs = await readPlaylist(pid, accessToken);
    }
    let added = 0;
    for (const s of songs) {
      if (isNon90s(s.title)) {
        filteredOut++;
        continue;
      }
      if (seenIds.has(s.videoId)) continue;
      const key = normaliseTitle(s.title);
      if (key && seenTitles.has(key)) {
        titleDuplicates++;
        continue;
      }
      seenIds.add(s.videoId);
      if (key) seenTitles.add(key);
      toAdd.push({ ...s, source: pid.slice(0, 8) });
      added++;
    }
    console.log(`  ${added} new songs from this source`);
  }

  if (titleDuplicates > 0) {
    console.log(`Skipped ${titleDuplicates} songs already present by title.`);
  }
  if (filteredOut > 0) {
    console.log(`Skipped ${filteredOut} songs filtered out (non-90s / regional).`);
  }

  console.log(`\n${toAdd.length} new songs to add.`);
  if (toAdd.length === 0) {
    console.log("Nothing to do — everything is already in your playlist. Bye!");
    return;
  }

  for (const s of toAdd.slice(0, LIMIT)) {
    console.log(`  - ${s.title}`);
  }
  if (toAdd.length > LIMIT) {
    console.log(`  … and ${toAdd.length - LIMIT} more (limited by --limit)`);
  }

  if (DRY_RUN) {
    console.log("\nDry run — no changes made.");
    return;
  }
  if (!accessToken) {
    throw new Error("Sync needs OAuth access to your playlist. Check GOOGLE_CLIENT_ID/SECRET.");
  }

  console.log("\nAdding songs...");

  let ok = 0;
  let failed = 0;
  for (let i = 0; i < Math.min(toAdd.length, LIMIT); i++) {
    const s = toAdd[i];
    try {
      await insertSong(DEST_PLAYLIST_ID, s.videoId, accessToken);
      ok++;
    } catch (e) {
      failed++;
      console.error(`  ✗ failed to add "${s.title}": ${(e as Error).message}`);
    }
    if (ok > 0 && ok % 10 === 0) console.log(`  added ${ok} so far…`);
  }

  console.log(`\nDone. Added ${ok} songs${failed ? `, ${failed} failed` : ""}.`);
  console.log("Quota note: each insert costs 50 units; the daily free quota is 10,000.");
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
