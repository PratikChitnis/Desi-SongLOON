"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import YouTubePlayer, { type PlayerHandle } from "./YouTubePlayer";
import type { NowPlaying } from "@/lib/types";

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
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center gap-8 px-4 py-10">
      <header className="text-center">
        <h1 className="font-mono text-3xl font-black tracking-[0.2em] text-amber-300 drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] sm:text-5xl">
          DESI SONGLOON
        </h1>
        <p className="mt-2 text-sm text-amber-100/70 sm:text-base">{tagline}</p>
      </header>

      <div className="my-auto w-full max-w-md rounded-2xl border border-white/10 bg-black/55 px-5 py-4 shadow-2xl backdrop-blur-md">
        <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-amber-300/80">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
          On air
        </p>

        <div className="mt-3 flex items-center gap-3">
          {!tunedIn ? (
            <button
              onClick={startListening}
              className="shrink-0 bg-amber-300 px-4 py-2 font-mono text-xs tracking-[0.2em] text-stone-900 transition hover:bg-amber-200"
            >
              TUNE IN
            </button>
          ) : (
            <button
              onClick={togglePlay}
              className="shrink-0 bg-amber-300 px-3 py-2 text-sm leading-none text-stone-900 transition hover:bg-amber-200"
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? "❚❚" : "▶"}
            </button>
          )}

          <h2 className="truncate text-lg font-semibold text-amber-50 drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)] sm:text-xl">
            {current?.title ?? "Tuning in…"}
          </h2>
        </div>

        <div className="mt-3 h-0.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-amber-300 transition-[width] duration-1000 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        {tunedIn && (
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="mt-3 w-full accent-amber-300"
            aria-label="Volume"
          />
        )}

        {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
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
