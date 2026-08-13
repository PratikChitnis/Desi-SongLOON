import { cached, DAY_MS } from "./cache";

const AUTH_URL = "https://accounts.spotify.com/api/token";
const API_URL = "https://api.spotify.com/v1";

interface SpotifyToken {
  access_token: string;
  expires_in: number;
}

let tokenCache: { token: string; expiresAt: number } | null = null;

async function getToken(
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now) return tokenCache.token;

  const body = new URLSearchParams({ grant_type: "client_credentials" });
  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) throw new Error(`Spotify auth failed (${res.status})`);
  const data: SpotifyToken = await res.json();
  tokenCache = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000 - 60_000,
  };
  return tokenCache.token;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: string;
  album: string;
  year: number;
  durationMs: number;
}

/**
 * Search Spotify for tracks matching `query`.
 * Cost: 1 token call (cached) + 1 search call per query.
 */
export async function searchSpotify(
  clientId: string,
  clientSecret: string,
  query: string,
  limit = 50,
): Promise<SpotifyTrack[]> {
  return cached(`spotify:${query}:${limit}`, DAY_MS, async () => {
    const token = await getToken(clientId, clientSecret);
    const url = new URL(`${API_URL}/search`);
    url.searchParams.set("q", query);
    url.searchParams.set("type", "track");
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("market", "IN");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Spotify search failed (${res.status})`);
    const json = (await res.json()) as {
      tracks: {
        items: {
          id: string;
          name: string;
          artists: { name: string }[];
          album: { name: string; release_date: string };
          duration_ms: number;
        }[];
      };
    };

    return json.tracks.items.map((t) => ({
      id: t.id,
      name: t.name,
      artists: t.artists.map((a) => a.name).join(", "),
      album: t.album.name,
      year: parseInt(t.album.release_date?.slice(0, 4) ?? "0"),
      durationMs: t.duration_ms,
    }));
  });
}
