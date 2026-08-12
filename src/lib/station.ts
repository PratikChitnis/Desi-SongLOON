import type { Station, Track } from "./types";
import romantic from "@/data/romantic.json";
import dance from "@/data/dance.json";
import soulful from "@/data/soulful.json";
import retroMix from "@/data/retro-mix.json";
import library01 from "@/data/library-01.json";
import library02 from "@/data/library-02.json";
import library03 from "@/data/library-03.json";
import library04 from "@/data/library-04.json";
import library05 from "@/data/library-05.json";
import library06 from "@/data/library-06.json";
import library07 from "@/data/library-07.json";
import library08 from "@/data/library-08.json";
import library09 from "@/data/library-09.json";

const playlists = [
  romantic,
  dance,
  soulful,
  retroMix,
  library01,
  library02,
  library03,
  library04,
  library05,
  library06,
  library07,
  library08,
  library09,
] as Station[];

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
