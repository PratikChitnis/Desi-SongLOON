"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import YouTubePlayer, { type PlayerHandle } from "./YouTubePlayer";
import type { Channel, ChannelId, NowPlaying } from "@/lib/types";

const formatTime = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

interface Props {
  channels: Pick<Channel, "id" | "name" | "tagline">[];
  initialChannel: ChannelId;
}

export default function Station({ channels, initialChannel }: Props) {
  const [channel, setChannel] = useState<ChannelId>(initialChannel);
  const [state, setState] = useState<NowPlaying | null>(null);
  const [tunedIn, setTunedIn] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(70);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handle = useRef<PlayerHandle | null>(null);
  const skipped = useRef(0);

  const tune = useCallback(async (channelId: ChannelId, autoplay: boolean) => {
    const res = await fetch(`/api/now-playing?channel=${channelId}`, { cache: "no-store" });
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
    void tune(channel, tunedIn);
  }, [channel, tunedIn, tune]);

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

  /** A pulled or region-blocked video must not stall the station. */
  const onError = useCallback(() => {
    skipped.current += 1;
    if (skipped.current > 3) {
      setError("Several tracks are unavailable here. Try another channel.");
      return;
    }
    setError("That track is unavailable — skipping ahead.");
    void tune(channel, true);
  }, [channel, tune]);

  const startListening = () => {
    setTunedIn(true);
    if (state) handle.current?.play(state.track.youtubeId, state.offsetSec);
  };

  const togglePlay = () => {
    if (playing) {
      handle.current?.pause();
    } else if (state) {
      // Resyncing rather than resuming keeps every listener on the station clock.
      void tune(channel, true);
    }
  };

  const current = state?.track;
  const progress = current ? Math.min(100, (elapsed / current.durationSec) * 100) : 0;
  const activeChannel = channels.find((c) => c.id === channel);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:py-12">
      <header className="text-center">
        <h1 className="font-mono text-3xl font-black tracking-[0.2em] text-amber-300 sm:text-5xl">
          DESI SONGLOON
        </h1>
        <p className="mt-2 text-sm text-amber-100/60 sm:text-base">
          90s Bollywood, playing round the clock
        </p>
      </header>

      <nav className="flex flex-wrap justify-center gap-2">
        {channels.map((c) => (
          <button
            key={c.id}
            onClick={() => {
              skipped.current = 0;
              setChannel(c.id);
            }}
            className={`rounded-full border px-4 py-1.5 text-sm transition ${
              c.id === channel
                ? "border-amber-300 bg-amber-300 font-semibold text-stone-900"
                : "border-amber-200/25 text-amber-100/70 hover:border-amber-200/60 hover:text-amber-100"
            }`}
          >
            {c.name}
          </button>
        ))}
      </nav>

      <div className="grid gap-6 md:grid-cols-[3fr_2fr]">
        <div className="overflow-hidden rounded-2xl border border-amber-200/15 bg-black shadow-2xl">
          <div className="relative aspect-video">
            <YouTubePlayer
              onReady={onReady}
              onEnded={() => void tune(channel, true)}
              onError={onError}
              onPlayingChange={setPlaying}
            />
            {!tunedIn && (
              <button
                onClick={startListening}
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-stone-950/90 text-amber-200 transition hover:bg-stone-950/80"
              >
                <span className="text-5xl">▶</span>
                <span className="font-mono text-lg tracking-[0.3em]">TUNE IN</span>
                <span className="text-xs text-amber-100/50">
                  Live since 2024 · you join wherever the station is
                </span>
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-amber-200/15 bg-stone-900/60 p-5">
          <div>
            <p className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-amber-300/70">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />
              On air · {activeChannel?.name}
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-amber-50">
              {current?.title ?? "Tuning in…"}
            </h2>
            <p className="text-sm text-amber-100/60">
              {current ? `${current.film} · ${current.year}` : activeChannel?.tagline}
            </p>
          </div>

          <div>
            <div className="h-1.5 overflow-hidden rounded-full bg-amber-100/10">
              <div className="h-full bg-amber-300 transition-[width] duration-1000 ease-linear" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-1 flex justify-between font-mono text-xs text-amber-100/50">
              <span>{formatTime(elapsed)}</span>
              <span>{current ? formatTime(current.durationSec) : "0:00"}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={togglePlay}
              disabled={!tunedIn}
              className="h-11 w-11 rounded-full bg-amber-300 text-lg text-stone-900 disabled:opacity-40"
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? "❚❚" : "▶"}
            </button>
            <button
              onClick={() => void tune(channel, tunedIn)}
              className="text-sm text-amber-100/60 underline-offset-4 hover:text-amber-100 hover:underline"
            >
              Sync to live
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="ml-auto w-24 accent-amber-300"
              aria-label="Volume"
            />
          </div>

          {error && <p className="text-xs text-red-300">{error}</p>}

          <div className="mt-auto">
            <p className="text-xs uppercase tracking-[0.25em] text-amber-300/60">Up next</p>
            <ul className="mt-2 space-y-1 text-sm text-amber-100/70">
              {(state?.upNext ?? []).map((t) => (
                <li key={t.youtubeId} className="truncate">
                  {t.title} <span className="text-amber-100/40">· {t.film}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <footer className="text-center text-xs text-amber-100/35">
        All music is streamed from official label uploads on YouTube. No audio is hosted here.
      </footer>
    </div>
  );
}
