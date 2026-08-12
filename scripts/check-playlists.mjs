/**
 * Verifies every track in src/data/*.json still resolves on YouTube.
 * Run periodically; tracks that fail have been pulled or made private.
 */
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data");

let broken = 0;
for (const file of (await readdir(DATA_DIR)).filter((f) => f.endsWith(".json"))) {
  const channel = JSON.parse(await readFile(join(DATA_DIR, file), "utf8"));
  for (const track of channel.tracks) {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${track.youtubeId}&format=json`,
    );
    if (!res.ok) {
      broken++;
      console.error(`BROKEN ${channel.id}  ${track.title} (${track.youtubeId}) -> ${res.status}`);
    }
  }
  console.log(`checked ${channel.id}: ${channel.tracks.length} tracks`);
}

if (broken > 0) {
  console.error(`\n${broken} broken track(s)`);
  process.exit(1);
}
console.log("\nall tracks OK");
