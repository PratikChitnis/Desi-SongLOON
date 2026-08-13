"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import YouTubePlayer, { type PlayerHandle } from "./YouTubePlayer";
import type { NowPlaying } from "@/lib/types";

/** Seconds as m:ss for the now-playing readout. */
function clock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

/** Fisher-Yates over 0..total-1, minus `first`, which is played up front. */
function shuffledQueue(total: number, first: number): number[] {
  const rest = Array.from({ length: total }, (_, i) => i).filter((i) => i !== first);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return rest;
}

export default function Station({ tagline }: { tagline: string }) {
  const [state, setState] = useState<NowPlaying | null>(null);
  const [tunedIn, setTunedIn] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(70);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handle = useRef<PlayerHandle | null>(null);
  const failures = useRef(0);
  /** Remaining tracks for this visit, so nothing repeats until the list runs out. */
  const queue = useRef<number[]>([]);

  /**
   * Loads a track from the day's running order. Omitting `index` lets the
   * server pick a random entry point; every track then plays from 0s.
   */
  const load = useCallback(async (index: number | undefined, autoplay: boolean) => {
    const query = index === undefined ? "" : `?index=${index}`;
    const res = await fetch(`/api/now-playing${query}`, { cache: "no-store" });
    if (!res.ok) {
      setError("Could not reach the station. Retrying shortly.");
      return;
    }
    const next: NowPlaying = await res.json();
    if (index === undefined) queue.current = shuffledQueue(next.total, next.index);
    setError(null);
    setState(next);
    setElapsed(0);
    if (autoplay) handle.current?.play(next.track.youtubeId, 0);
  }, []);

  useEffect(() => {
    void load(undefined, false);
  }, [load]);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, [playing]);

  useEffect(() => {
    handle.current?.setVolume(volume);
  }, [volume]);

  const onReady = useCallback(
    (h: PlayerHandle) => {
      handle.current = h;
      h.setVolume(volume);
    },
    [volume],
  );

  /** Advances to the next track of this visit's shuffle, reshuffling on exhaustion. */
  const next = useCallback(() => {
    const upcoming = queue.current.shift();
    if (upcoming === undefined) {
      void load(undefined, true);
      return;
    }
    void load(upcoming, true);
  }, [load]);

  /** A track that played to the end clears the consecutive-failure count. */
  const onEnded = useCallback(() => {
    failures.current = 0;
    next();
  }, [next]);

  /** A pulled or region-blocked video must not stall the station. */
  const onError = useCallback(() => {
    failures.current += 1;
    if (failures.current > 3) {
      setError("Several tracks in a row are unavailable here. Try again later.");
      return;
    }
    setError("That track is unavailable — skipping ahead.");
    next();
  }, [next]);

  const startListening = () => {
    setTunedIn(true);
    failures.current = 0;
    if (state) handle.current?.play(state.track.youtubeId, 0);
  };

  const togglePlay = () => {
    if (playing) handle.current?.pause();
    else handle.current?.resume();
  };

  const current = state?.track;
  const progress = current ? Math.min(100, (elapsed / current.durationSec) * 100) : 0;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center gap-8 px-4 py-10">
      <header className="text-center">
        <h1 className="font-mono text-3xl font-black tracking-[0.2em] text-amber-300 drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] sm:text-5xl">
          DESI SONGLOON
        </h1>
        <p className="mt-2 text-sm text-amber-100/70 sm:text-base">{tagline}</p>
      </header>

      <div className="my-auto w-full max-w-3xl">
        <div className="glass-card flex items-center gap-4 rounded-[2rem] px-4 py-4 sm:gap-6 sm:px-6 sm:py-5">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full ring-1 ring-white/25 sm:h-[5.5rem] sm:w-[5.5rem]">
            {current ? (
              <Image
                src={`https://i.ytimg.com/vi/${current.youtubeId}/mqdefault.jpg`}
                alt=""
                fill
                sizes="88px"
                unoptimized
                className="scale-[1.35] object-cover"
              />
            ) : (
              <div className="h-full w-full bg-white/10" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.7)] sm:text-2xl">
              {current?.title ?? "Tuning in…"}
            </h2>
            <p className="mt-0.5 truncate text-xs text-white/60 sm:text-sm">
              {current ? `${current.film} · ${current.year}` : "Desi SongLOON radio"}
            </p>

            <div className="mt-3 flex items-center gap-3">
              <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-white transition-[width] duration-1000 ease-linear"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="shrink-0 font-mono text-xs tabular-nums text-white/70">
                {clock(elapsed)} / {current ? clock(current.durationSec) : "0:00"}
              </span>
            </div>
          </div>

          <button
            onClick={tunedIn ? togglePlay : startListening}
            className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white/90 text-stone-900 shadow-lg transition hover:bg-white sm:h-16 sm:w-16"
            aria-label={!tunedIn ? "Tune in" : playing ? "Pause" : "Play"}
          >
            {tunedIn && playing ? (
              <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current sm:h-7 sm:w-7">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="ml-0.5 h-6 w-6 fill-current sm:h-7 sm:w-7">
                <path d="M8 5.5v13l11-6.5z" />
              </svg>
            )}
          </button>

          <div className="hidden items-center gap-3 pr-1 sm:flex">
            <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 fill-white/80">
              <path d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z" />
            </svg>
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="volume-slider w-24"
              aria-label="Volume"
            />
          </div>
        </div>

        {error && <p className="mt-3 text-center text-xs text-red-300">{error}</p>}
      </div>

      {/* The player only supplies audio; it is parked offscreen rather than unmounted. */}
      <div className="pointer-events-none fixed -left-[9999px] top-0 h-[240px] w-[320px]">
        <YouTubePlayer
          onReady={onReady}
          onEnded={onEnded}
          onError={onError}
          onPlayingChange={setPlaying}
        />
      </div>
    </div>
  );
}
