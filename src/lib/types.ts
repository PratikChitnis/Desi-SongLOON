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
  /** Position of the track in today's running order. */
  index: number;
  /** Number of tracks in today's running order. */
  total: number;
}
