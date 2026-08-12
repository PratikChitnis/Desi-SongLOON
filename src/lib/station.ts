import type { Station, Track } from "./types";
import romantic from "@/data/romantic.json";
import dance from "@/data/dance.json";
import soulful from "@/data/soulful.json";
import retroMix from "@/data/retro-mix.json";

const playlists = [romantic, dance, soulful, retroMix] as Station[];

/** One station: every curated playlist merged, deduplicated by video id. */
export const station: Station = {
  id: "desi-songloon",
  name: "Desi SongLOON",
  tagline: "90s Bollywood, playing round the clock",
  tracks: Object.values(
    playlists
      .flatMap((p) => p.tracks)
      .reduce<Record<string, Track>>((byId, track) => {
        byId[track.youtubeId] ??= track;
        return byId;
      }, {}),
  ),
};
