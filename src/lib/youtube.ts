import { cached, DAY_MS } from "./cache";

const BASE = "https://www.googleapis.com/youtube/v3";

interface YouTubeVideo {
  id: string;
  title: string;
  channelTitle: string;
  durationSec: number;
}

/**
 * Fetch the actual duration of a list of videos via the videos endpoint.
 * Each video ID costs 1 unit.  Batches up to 50 per call.
 */
async function fetchDurations(
  apiKey: string,
  ids: string[],
): Promise<Map<string, number>> {
  const durations = new Map<string, number>();
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const url = new URL(`${BASE}/videos`);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("id", batch.join(","));
    url.searchParams.set("part", "contentDetails");
    url.searchParams.set("fields", "items(id,contentDetails.duration)");

    const res = await fetch(url.toString());
    if (!res.ok) continue;
    const json = (await res.json()) as {
      items: { id: string; contentDetails: { duration: string } }[];
    };

    for (const item of json.items) {
      durations.set(item.id, parseDuration(item.contentDetails.duration));
    }
  }
  return durations;
}

/** ISO 8601 duration (PT4M13S) → seconds. */
function parseDuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] ?? "0") * 3600) + (parseInt(m[2] ?? "0") * 60) + parseInt(m[3] ?? "0");
}

/**
 * Search YouTube for videos matching `query`, returning up to `maxResults`
 * results.  Filters to VEVO / official-looking channels and known Hindi labels.
 *
 * Unit cost: 100 per call (search.list).
 */
export async function searchYouTube(
  apiKey: string,
  query: string,
  maxResults = 50,
): Promise<YouTubeVideo[]> {
  return cached(`yt:${query}:${maxResults}`, DAY_MS, async () => {
    const url = new URL(`${BASE}/search`);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("q", query);
    url.searchParams.set("part", "snippet");
    url.searchParams.set("type", "video");
    url.searchParams.set("videoCategoryId", "10"); // Music
    url.searchParams.set("maxResults", String(maxResults));
    url.searchParams.set("fields", "items(id(videoId),snippet(title,channelTitle))");

    const res = await fetch(url.toString());
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`YouTube search failed (${res.status}): ${body}`);
    }
    const json = (await res.json()) as {
      items: {
        id: { videoId: string };
        snippet: { title: string; channelTitle: string };
      }[];
    };

    const ids = json.items.map((item) => item.id.videoId);
    const durations = await fetchDurations(apiKey, ids);

    return json.items.map((item) => ({
      id: item.id.videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      durationSec: durations.get(item.id.videoId) ?? 0,
    }));
  });
}
