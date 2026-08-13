"use client";

import { useEffect, useRef } from "react";

interface YTPlayer {
  loadVideoById(options: { videoId: string; startSeconds?: number }): void;
  cueVideoById(options: { videoId: string; startSeconds?: number }): void;
  playVideo(): void;
  pauseVideo(): void;
  setVolume(volume: number): void;
  getCurrentTime(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  destroy(): void;
}

interface YTNamespace {
  Player: new (
    element: HTMLElement,
    options: {
      videoId?: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: () => void;
        onStateChange?: (event: { data: number }) => void;
        onError?: () => void;
      };
    },
  ) => YTPlayer;
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number; BUFFERING: number };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;

function loadApi(): Promise<YTNamespace> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT!);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });
  return apiPromise;
}

export interface PlayerHandle {
  play(videoId: string, startSeconds: number): void;
  cue(videoId: string): void;
  playInstant(): void;
  pause(): void;
  resume(): void;
  setVolume(volume: number): void;
  seekTo(seconds: number): void;
}

interface Props {
  onReady(handle: PlayerHandle): void;
  onEnded(): void;
  onError(): void;
  onPlayingChange(playing: boolean): void;
}

export default function YouTubePlayer({ onReady, onEnded, onError, onPlayingChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onReady, onEnded, onError, onPlayingChange });
  callbacks.current = { onReady, onEnded, onError, onPlayingChange };

  useEffect(() => {
    let player: YTPlayer | undefined;
    let cancelled = false;

    loadApi().then((YT) => {
      if (cancelled || !containerRef.current) return;
      player = new YT.Player(containerRef.current, {
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: () =>
            callbacks.current.onReady({
              play: (videoId, startSeconds) => {
                player?.loadVideoById({ videoId, startSeconds });
                player?.playVideo();
              },
              cue: (videoId) => {
                player?.cueVideoById({ videoId });
              },
              playInstant: () => {
                player?.playVideo();
              },
              pause: () => player?.pauseVideo(),
              resume: () => player?.playVideo(),
              setVolume: (volume) => player?.setVolume(volume),
              seekTo: (seconds) => player?.seekTo(seconds, true),
            }),
          onStateChange: (event) => {
            if (event.data === YT.PlayerState.ENDED) callbacks.current.onEnded();
            callbacks.current.onPlayingChange(event.data === YT.PlayerState.PLAYING);
          },
          onError: () => callbacks.current.onError(),
        },
      });
    });

    return () => {
      cancelled = true;
      player?.destroy();
    };
  }, []);

  return <div ref={containerRef} className="h-full w-full" />;
}
