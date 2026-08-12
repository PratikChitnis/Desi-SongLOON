/**
 * Resolves the curated song list in scripts/songs.json into playable playlists.
 *
 * For each song it searches YouTube, keeps the best match uploaded by an
 * official label channel, and writes src/data/<channel>.json.
 *
 *   node scripts/build-playlists.mjs [channelId ...]
 */
import { writeFile, readFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = join(ROOT, "src", "data");

/** Uploads from these channels are label-owned, so embedding is safe and stable. */
const OFFICIAL_CHANNELS = [
  "t-series",
  "saregama music",
  "tips official",
  "tips films",
  "sony music india",
  "venus movies",
  "shemaroo filmi gaane",
  "zee music company",
  "ultra bollywood",
  "yrf",
  "eros now music",
];

const isOfficial = (name = "") => OFFICIAL_CHANNELS.some((c) => name.toLowerCase().includes(c));

const parseDuration = (text = "") => {
  const parts = text.split(":").map(Number);
  if (parts.some(Number.isNaN)) return 0;
  return parts.reduce((total, part) => total * 60 + part, 0);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchSearchHtml(query, attempt = 0) {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "accept-language": "en-US,en;q=0.9",
        cookie: "CONSENT=YES+cb; SOCS=CAI",
      },
    });
    return await res.text();
  } catch (error) {
    if (attempt >= 3) throw error;
    await sleep(3000 * (attempt + 1));
    return fetchSearchHtml(query, attempt + 1);
  }
}

async function search(query) {
  const html = await fetchSearchHtml(query);
  const match = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
  if (!match) return [];

  const results = [];
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    if (node.videoRenderer?.videoId) {
      const v = node.videoRenderer;
      results.push({
        youtubeId: v.videoId,
        ytTitle: v.title?.runs?.[0]?.text ?? "",
        channel: v.ownerText?.runs?.[0]?.text ?? "",
        durationSec: parseDuration(v.lengthText?.simpleText),
      });
    }
    Object.values(node).forEach(walk);
  };
  walk(JSON.parse(match[1]));
  return results;
}

async function resolve(song) {
  let results = [];
  try {
    results = await search(`${song.title} ${song.film} ${song.year} full video song`);
  } catch {
    return null;
  }
  const candidate = results.find(
    (r) => isOfficial(r.channel) && r.durationSec >= 120 && r.durationSec <= 600,
  );
  if (!candidate) return null;
  return {
    youtubeId: candidate.youtubeId,
    title: song.title,
    film: song.film,
    year: song.year,
    durationSec: candidate.durationSec,
  };
}

const songs = JSON.parse(await readFile(join(ROOT, "scripts", "songs.json"), "utf8"));
const wanted = process.argv.slice(2);

await mkdir(DATA_DIR, { recursive: true });

for (const channel of songs.channels) {
  if (wanted.length && !wanted.includes(channel.id)) continue;

  const tracks = [];
  for (const song of channel.songs) {
    const track = await resolve(song);
    if (track) {
      tracks.push(track);
      console.log(`ok   ${channel.id}  ${song.title} -> ${track.youtubeId} (${track.durationSec}s)`);
    } else {
      console.warn(`skip ${channel.id}  ${song.title} (no official upload found)`);
    }
    await sleep(1200);
  }

  const out = { id: channel.id, name: channel.name, tagline: channel.tagline, tracks };
  await writeFile(join(DATA_DIR, `${channel.id}.json`), `${JSON.stringify(out, null, 2)}\n`);
  console.log(`wrote src/data/${channel.id}.json with ${tracks.length} tracks`);
}
