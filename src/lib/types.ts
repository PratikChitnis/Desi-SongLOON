export interface Track {
  /** YouTube video id of an official label upload. */
  youtubeId: string;
  title: string;
  film: string;
  year: number;
  durationSec: number;
}

export interface Station {
  id: string;
  name: string;
  tagline: string;
  tracks: Track[];
}

export interface NowPlaying {
  track: Track;
  /** Seconds already elapsed in the current track at `serverTime`. */
  offsetSec: number;
  /** Seconds until the next track starts. */
  remainingSec: number;
  /** Epoch millis on the server when this response was computed. */
  serverTime: number;
}
