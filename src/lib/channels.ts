import type { Channel, ChannelId } from "./types";
import romantic from "@/data/romantic.json";
import dance from "@/data/dance.json";
import soulful from "@/data/soulful.json";
import retroMix from "@/data/retro-mix.json";

export const channels: Channel[] = [romantic, dance, soulful, retroMix] as Channel[];

export const DEFAULT_CHANNEL: ChannelId = "romantic";

export function getChannel(id: string | null | undefined): Channel {
  return channels.find((c) => c.id === id) ?? channels.find((c) => c.id === DEFAULT_CHANNEL)!;
}
