export type ChannelId = "romantic" | "dance" | "soulful" | "retro-mix";

export interface Track {
  /** YouTube video id of an official label upload. */
  youtubeId: string;
  title: string;
  film: string;
  year: number;
  durationSec: number;
}

export interface Channel {
  id: ChannelId;
  name: string;
  tagline: string;
  tracks: Track[];
}

export interface NowPlaying {
  channel: ChannelId;
  track: Track;
  /** Seconds already elapsed in the current track at `serverTime`. */
  offsetSec: number;
  /** Seconds until the next track starts. */
  remainingSec: number;
  /** Epoch millis on the server when this response was computed. */
  serverTime: number;
  upNext: Track[];
}
