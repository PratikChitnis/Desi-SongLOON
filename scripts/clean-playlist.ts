/**
 * Clean the destination playlist: remove songs that don't pass the station
 * filters (non-90s, too short, too long).
 *
 * Usage:
 *   npx tsx scripts/clean-playlist.ts --dry-run   (preview only)
 *   npx tsx scripts/clean-playlist.ts             (actually delete)
 *
 * Requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local.
 * Uses the same OAuth loopback flow as sync-playlist.ts.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { exec, execFile } from "node:child_process";
import * as path from "node:path";
import { isNon90s } from "../src/lib/non90s";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PLAYLIST_ID =
  process.env.YOUTUBE_PLAYLIST_ID ?? "PL7E6RBJ3R2ay6WkbHxhwhhNE2QiFvROpm";

const API_BASE = "https://www.googleapis.com/youtube/v3";
const TOKEN_FILE = path.join(__dirname, ".yt-token.json");
const FETCH_TIMEOUT_MS = 30_000;
const MIN_DURATION_SEC = 60;
const MAX_DURATION_SEC = 900;

const DRY_RUN = process.argv.includes("--dry-run");

// ---------------------------------------------------------------------------
// Env loader
// ---------------------------------------------------------------------------

function loadEnv(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {};
  try {
    const raw = readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch { /* rely on process.env */ }
  return { ...env, ...process.env };
}

const env = loadEnv();
const CLIENT_ID = env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET;
const SCOPES = "https://www.googleapis.com/auth/youtube.force-ssl";

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

async function fetchTimeout(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try { return await fetch(url, { ...init, signal: ctrl.signal }); }
  finally { clearTimeout(t); }
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetchTimeout(url, init);
  if (!res.ok) throw new Error(`API error (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// OAuth
// ---------------------------------------------------------------------------

interface TokenStore { access_token: string; refresh_token: string; expires_at: number; }

function loadToken(): TokenStore | null {
  try { return JSON.parse(readFileSync(TOKEN_FILE, "utf8")); } catch { return null; }
}
function saveToken(t: TokenStore) {
  writeFileSync(TOKEN_FILE, JSON.stringify(t, null, 2), { mode: 0o600 });
}

async function refreshAccessToken(refresh: string): Promise<TokenStore> {
  const body = new URLSearchParams({
    client_id: CLIENT_ID!, client_secret: CLIENT_SECRET!,
    refresh_token: refresh, grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body,
  });
  if (!res.ok) throw new Error(`Token refresh failed (${res.status})`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  return { access_token: data.access_token, refresh_token: refresh, expires_at: Date.now() + (data.expires_in - 60) * 1000 };
}

function openBrowser(url: string) {
  if (process.platform === "win32") execFile("rundll32", ["url.dll,FileProtocolHandler", url], () => {});
  else if (process.platform === "darwin") exec(`open "${url}"`, () => {});
  else exec(`xdg-open "${url}"`, () => {});
}

async function authorize(): Promise<TokenStore> {
  const port = 34567;
  const redirectUri = `http://localhost:${port}`;
  const code = await new Promise<string>((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", redirectUri);
      const c = url.searchParams.get("code");
      const e = url.searchParams.get("error");
      if (c || e) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<html><body style='font-family:sans-serif;text-align:center;margin-top:20vh'><h2>Done! Close this tab.</h2></body></html>");
        server.close();
        c ? resolve(c) : reject(new Error(`OAuth denied: ${e}`));
      }
    });
    server.listen(port, () => {
      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", CLIENT_ID!);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", SCOPES);
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("prompt", "consent");
      console.log("\nOpening browser for Google sign-in...");
      console.log(`If it doesn't open, paste this URL:\n${authUrl}\n`);
      openBrowser(authUrl.toString());
    });
    server.on("error", reject);
  });
  const body = new URLSearchParams({
    client_id: CLIENT_ID!, client_secret: CLIENT_SECRET!,
    code, redirect_uri: redirectUri, grant_type: "authorization_code",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body,
  });
  if (!res.ok) throw new Error(`Token exchange failed (${res.status})`);
  const data = (await res.json()) as { access_token: string; refresh_token: string; expires_in: number };
  if (!data.refresh_token) throw new Error("No refresh token. Revoke the app in Google account and try again.");
  const token: TokenStore = { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: Date.now() + (data.expires_in - 60) * 1000 };
  saveToken(token);
  return token;
}

async function getToken(): Promise<string> {
  let token = loadToken();
  if (token && token.expires_at > Date.now()) return token.access_token;
  if (token?.refresh_token) {
    try { token = await refreshAccessToken(token.refresh_token); saveToken(token); return token.access_token; }
    catch { /* re-authorize */ }
  }
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local");
  token = await authorize();
  return token.access_token;
}

// ---------------------------------------------------------------------------
// Playlist helpers
// ---------------------------------------------------------------------------

interface PlaylistItem { itemId: string; videoId: string; title: string; }

async function readPlaylist(accessToken: string): Promise<PlaylistItem[]> {
  const out: PlaylistItem[] = [];
  let pageToken: string | undefined;
  for (let i = 0; i < 200; i++) {
    const url = new URL(`${API_BASE}/playlistItems`);
    url.searchParams.set("part", "snippet");
    url.searchParams.set("playlistId", PLAYLIST_ID);
    url.searchParams.set("maxResults", "50");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const page = await api<{ items?: { id?: string; snippet: { resourceId: { videoId: string }; title: string } }[]; nextPageToken?: string }>(
      url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    for (const item of page.items ?? []) {
      const vid = item.snippet?.resourceId?.videoId;
      const title = item.snippet?.title ?? "";
      if (!vid || title === "Private video" || title === "Deleted video") continue;
      out.push({ itemId: item.id ?? "", videoId: vid, title });
    }
    pageToken = page.nextPageToken;
    if (!pageToken) break;
  }
  return out;
}

async function getDurations(videoIds: string[], accessToken: string): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  // Batch in groups of 50
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const url = new URL(`${API_BASE}/videos`);
    url.searchParams.set("part", "contentDetails");
    url.searchParams.set("id", batch.join(","));
    url.searchParams.set("maxResults", "50");
    const page = await api<{ items?: { id: string; contentDetails: { duration: string } }[] }>(
      url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    for (const item of page.items ?? []) {
      const iso = item.contentDetails.duration;
      // Parse ISO 8601 duration: PT1M23S → 83s
      const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (m) {
        const sec = (parseInt(m[1] || "0") * 3600) + (parseInt(m[2] || "0") * 60) + parseInt(m[3] || "0");
        map.set(item.id, sec);
      }
    }
  }
  return map;
}

async function deleteItems(itemIds: string[], accessToken: string) {
  for (const id of itemIds) {
    const url = `${API_BASE}/playlistItems?id=${id}`;
    await fetchTimeout(url, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } });
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Reading playlist ${PLAYLIST_ID}...`);
  const token = await getToken();
  const items = await readPlaylist(token);
  console.log(`Found ${items.length} videos.`);

  // Phase 1: title-based filter (no extra API calls)
  const titleFiltered = items.filter((v) => isNon90s(v.title));
  console.log(`\nNon-90s by title: ${titleFiltered.length}`);
  for (const v of titleFiltered.slice(0, 10)) console.log(`  - ${v.title}`);
  if (titleFiltered.length > 10) console.log(`  ... and ${titleFiltered.length - 10} more`);

  // Phase 2: duration filter
  const remaining = items.filter((v) => !isNon90s(v.title));
  const ids = remaining.map((v) => v.videoId);
  console.log(`\nFetching durations for ${ids.length} remaining videos...`);
  const durations = await getDurations(ids, token);

  const durationFiltered: PlaylistItem[] = [];
  for (const v of remaining) {
    const dur = durations.get(v.videoId) ?? 0;
    if (dur < MIN_DURATION_SEC || dur > MAX_DURATION_SEC) {
      durationFiltered.push(v);
    }
  }
  console.log(`\nDuration filter (${MIN_DURATION_SEC}-${MAX_DURATION_SEC}s): ${durationFiltered.length} to remove`);
  for (const v of durationFiltered.slice(0, 10)) {
    const dur = durations.get(v.videoId) ?? 0;
    console.log(`  - ${v.title} (${dur}s)`);
  }
  if (durationFiltered.length > 10) console.log(`  ... and ${durationFiltered.length - 10} more`);

  const toDelete = [...titleFiltered, ...durationFiltered];
  console.log(`\n${DRY_RUN ? "DRY RUN" : "DELETE"}: ${toDelete.length} videos will be removed from playlist.`);

  if (DRY_RUN || toDelete.length === 0) return;

  // Delete in batches (API allows 50 per second)
  console.log("\nDeleting...");
  const deleteIds = toDelete.map((v) => v.itemId);
  for (let i = 0; i < deleteIds.length; i += 50) {
    const batch = deleteIds.slice(i, i + 50);
    await deleteItems(batch, token);
    process.stdout.write(`  ${Math.min(i + 50, deleteIds.length)}/${deleteIds.length}\r`);
  }
  console.log(`\nDone! ${toDelete.length} videos removed. Rebuild the station to reload.`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
