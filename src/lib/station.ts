import type { Station, Track } from "./types";
import { hash } from "./scheduler";
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

interface Theme {
  id: string;
  name: string;
  tagline: string;
  seed: Station;
}

const themes: Theme[] = [
  {
    id: "romantic",
    name: "Romantic",
    tagline: "Melodies from the golden age of Bollywood romance",
    seed: romantic as Station,
  },
  {
    id: "dance",
    name: "Dance Floor",
    tagline: "Big beats from the 90s dance floor",
    seed: dance as Station,
  },
  {
    id: "soulful",
    name: "Soulful",
    tagline: "Slow, aching and unforgettable",
    seed: soulful as Station,
  },
  {
    id: "retro-mix",
    name: "Retro Mix",
    tagline: "Everything else the decade had on repeat",
    seed: retroMix as Station,
  },
];

/** Batches resolved after the themed lists; they carry no mood of their own. */
const library = [
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

const themed = new Set(themes.flatMap((t) => t.seed.tracks.map((track) => track.youtubeId)));

const unthemed = Object.values(
  library
    .flatMap((p) => p.tracks)
    .reduce<Record<string, Track>>((byId, track) => {
      if (!themed.has(track.youtubeId)) byId[track.youtubeId] ??= track;
      return byId;
    }, {}),
);

/**
 * The four themed channels. Each is seeded by its curated mood list; the rest
 * of the library is spread across them by a stable hash of the video id, so a
 * song always lands on the same channel but no channel is left tiny.
 */
export const channels: Station[] = themes.map((theme, position) => ({
  id: theme.id,
  name: theme.name,
  tagline: theme.tagline,
  tracks: [
    ...theme.seed.tracks,
    ...unthemed.filter((track) => hash(track.youtubeId) % themes.length === position),
  ],
}));

export const defaultChannel = channels[0];

export function channelById(id: string | null | undefined): Station {
  return channels.find((channel) => channel.id === id) ?? defaultChannel;
}
