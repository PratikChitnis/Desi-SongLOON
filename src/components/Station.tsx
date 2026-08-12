"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import YouTubePlayer, { type PlayerHandle } from "./YouTubePlayer";
import type { NowPlaying } from "@/lib/types";

export default function Station({ tagline }: { tagline: string }) {
  const [state, setState] = useState<NowPlaying | null>(null);
  const [tunedIn, setTunedIn] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(70);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handle = useRef<PlayerHandle | null>(null);
  const skipped = useRef(0);
  /** Seconds the listener has been fast-forwarded past unplayable tracks. */
  const advanceSec = useRef(0);

  const tune = useCallback(async (autoplay: boolean) => {
    const res = await fetch(`/api/now-playing?advance=${Math.round(advanceSec.current)}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      setError("Could not reach the station. Retrying shortly.");
      return;
    }
    const next: NowPlaying = await res.json();
    setError(null);
    setState(next);
    setElapsed(next.offsetSec);
    if (autoplay) handle.current?.play(next.track.youtubeId, next.offsetSec);
  }, []);

  useEffect(() => {
    void tune(false);
  }, [tune]);

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

  /**
   * A pulled or region-blocked video must not stall the station. The schedule is
   * derived from the clock, so re-querying the current instant would return the
   * same track: advance the query past the rest of it to reach the next one.
   */
  const onError = useCallback(() => {
    skipped.current += 1;
    advanceSec.current += (state?.remainingSec ?? 0) + 1;
    if (skipped.current > 3) {
      setError("Several tracks in a row are unavailable here. Try again later.");
      return;
    }
    setError("That track is unavailable — skipping ahead.");
    void tune(true);
  }, [state, tune]);

  const startListening = () => {
    setTunedIn(true);
    if (state) handle.current?.play(state.track.youtubeId, state.offsetSec);
  };

  const togglePlay = () => {
    if (playing) {
      handle.current?.pause();
    } else {
      advanceSec.current = 0;
      // Resyncing rather than resuming keeps every listener on the station clock.
      void tune(true);
    }
  };

  const current = state?.track;
  const progress = current ? Math.min(100, (elapsed / current.durationSec) * 100) : 0;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-8 px-4 py-10">
      <header className="text-center">
        <h1 className="font-mono text-3xl font-black tracking-[0.2em] text-amber-300 drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] sm:text-5xl">
          DESI SONGLOON
        </h1>
        <p className="mt-2 text-sm text-amber-100/70 sm:text-base">{tagline}</p>
      </header>

      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-black/45 p-8 text-center shadow-2xl backdrop-blur-md">
        <p className="flex items-center justify-center gap-2 text-xs uppercase tracking-[0.3em] text-amber-300/80">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />
          On air
        </p>

        <h2 className="mt-5 text-3xl font-semibold leading-snug text-amber-50 sm:text-4xl">
          {current?.title ?? "Tuning in…"}
        </h2>

        <div className="mx-auto mt-6 h-1 max-w-xs overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-amber-300 transition-[width] duration-1000 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        {!tunedIn ? (
          <button
            onClick={startListening}
            className="mt-8 rounded-full bg-amber-300 px-8 py-3 font-mono text-sm tracking-[0.3em] text-stone-900 transition hover:bg-amber-200"
          >
            TUNE IN
          </button>
        ) : (
          <div className="mt-8 flex items-center justify-center gap-5">
            <button
              onClick={togglePlay}
              className="h-12 w-12 rounded-full bg-amber-300 text-lg text-stone-900 transition hover:bg-amber-200"
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? "❚❚" : "▶"}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-32 accent-amber-300"
              aria-label="Volume"
            />
          </div>
        )}

        {error && <p className="mt-4 text-xs text-red-300">{error}</p>}
      </div>

      {/* The player only supplies audio; it is parked offscreen rather than unmounted. */}
      <div className="pointer-events-none fixed -left-[9999px] top-0 h-[240px] w-[320px]">
        <YouTubePlayer
          onReady={onReady}
          onEnded={() => void tune(true)}
          onError={onError}
          onPlayingChange={setPlaying}
        />
      </div>
    </div>
  );
}
