import { cached, clearCache, DAY_MS } from "./cache";

const BASE = "https://www.googleapis.com/youtube/v3";

/** Decode HTML entities that YouTube returns in titles (e.g. &#39; → '). */
function decodeHtml(s: string): string {
  return s
    .replace(/&#39;/g, "'")
    .replace(/&#34;/g, '"')
    .replace(/&#38;/g, "&")
    .replace(/&#60;/g, "<")
    .replace(/&#62;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

interface YouTubeVideo {
  id: string;
  title: string;
  channelTitle: string;
  durationSec: number;
}

/**
 * Fetch the actual duration of a list of videos via the videos endpoint.
 * Each video ID costs 1 unit.  Batches up to 50 per call.
 * Tries fallback key if primary returns 429.
 */
async function fetchDurations(
  apiKey: string,
  ids: string[],
  fallbackKey?: string,
): Promise<Map<string, number>> {
  const durations = new Map<string, number>();
  let currentKey = apiKey;

  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const url = new URL(`${BASE}/videos`);
    url.searchParams.set("key", currentKey);
    url.searchParams.set("id", batch.join(","));
    url.searchParams.set("part", "contentDetails");
    url.searchParams.set("fields", "items(id,contentDetails.duration)");

    const res = await fetch(url.toString());

    // Try fallback key on 429
    if (res.status === 429 && fallbackKey && currentKey !== fallbackKey) {
      currentKey = fallbackKey;
      i -= 50; // Retry this batch with fallback key
      continue;
    }

    if (!res.ok) continue;
    const json = (await res.json()) as {
      items: { id: string; contentDetails: { duration: string } }[];
    };

    for (const item of json.items) {
      const duration = item.contentDetails?.duration;
      durations.set(item.id, duration ? parseDuration(duration) : 0);
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
 * results.  Paginates automatically (50 results per page).
 * Tries fallbackKey if primary key returns 429 (quota exceeded).
 *
 * Unit cost: 100 per page (search.list).
 */
export async function searchYouTube(
  apiKey: string,
  query: string,
  maxResults = 50,
  fallbackKey?: string,
): Promise<YouTubeVideo[]> {
  return cached(`yt:${query}:${maxResults}`, DAY_MS, async () => {
    const allItems: {
      id: { videoId: string };
      snippet: { title: string; channelTitle: string };
    }[] = [];

    let pageToken: string | undefined;
    const perPage = Math.min(maxResults, 50);
    let currentKey = apiKey;
    let switchedKey = false;

    while (allItems.length < maxResults) {
      const url = new URL(`${BASE}/search`);
      url.searchParams.set("key", currentKey);
      url.searchParams.set("q", query);
      url.searchParams.set("part", "snippet");
      url.searchParams.set("type", "video");
      url.searchParams.set("videoCategoryId", "10"); // Music
      url.searchParams.set("videoDuration", "medium"); // 4-20 min — individual songs only
      url.searchParams.set("maxResults", String(Math.min(perPage, maxResults - allItems.length)));
      url.searchParams.set("fields", "nextPageToken,items(id(videoId),snippet(title,channelTitle))");
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const res = await fetch(url.toString());

      // If primary key is rate-limited, try fallback
      if (res.status === 429 && fallbackKey && currentKey !== fallbackKey && !switchedKey) {
        currentKey = fallbackKey;
        switchedKey = true;
        clearCache(); // Clear stale cache from failed key
        continue; // Retry with fallback key
      }

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`YouTube search failed (${res.status}): ${body}`);
      }
      const json = (await res.json()) as {
        nextPageToken?: string;
        items: {
          id: { videoId: string };
          snippet: { title: string; channelTitle: string };
        }[];
      };

      allItems.push(...json.items);

      if (!json.nextPageToken || json.items.length === 0) break;
      pageToken = json.nextPageToken;
    }

    const ids = allItems.map((item) => item.id.videoId);
    const durations = await fetchDurations(currentKey, ids, fallbackKey);

    return allItems.map((item) => ({
      id: item.id.videoId,
      title: decodeHtml(item.snippet.title),
      channelTitle: decodeHtml(item.snippet.channelTitle),
      durationSec: durations.get(item.id.videoId) ?? 0,
    }));
  });
}
