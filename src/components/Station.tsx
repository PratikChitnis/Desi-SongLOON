"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import VolumeControl from "./VolumeControl";
import YouTubePlayer, { type PlayerHandle } from "./YouTubePlayer";
import { nowPlaying } from "@/lib/scheduler";
import type { NowPlaying, Track } from "@/lib/types";

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

export interface ChannelInfo {
  id: string;
  name: string;
  tagline: string;
  tracks: Track[];
}

export default function Station({ channels }: { channels: ChannelInfo[] }) {
  const channelsRef = useRef(channels);
  channelsRef.current = channels;

  const [channelId, setChannelId] = useState(channels[0].id);
  const [tunedIn, setTunedIn] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handle = useRef<PlayerHandle | null>(null);
  const failures = useRef(0);
  const volume = useRef(70);
  const queue = useRef<number[]>([]);
  const history = useRef<number[]>([]);

  const channelRef = useRef(channelId);
  channelRef.current = channelId;

  /** Whether the player has fired onReady yet. */
  const playerReady = useRef(false);
  /** Queued play command, executed once the player fires onReady. */
  const pendingPlay = useRef<{ videoId: string; start: number } | null>(null);
  /** Guard against rapid duplicate onEnded fires. */
  const advancing = useRef(false);

  const getChannel = useCallback(
    (id: string) => channelsRef.current.find((c) => c.id === id) ?? channelsRef.current[0],
    [],
  );

  const load = useCallback(
    (index: number | undefined, autoplay: boolean) => {
      const ch = getChannel(channelRef.current);
      const station = { id: ch.id, name: ch.name, tagline: ch.tagline, tracks: ch.tracks };
      const next = nowPlaying(station, index);
      if (index === undefined) queue.current = shuffledQueue(next.total, next.index);
      setError(null);
      setElapsed(0);
      advancing.current = false;
      setState(next);
      if (autoplay) {
        if (playerReady.current) {
          handle.current?.play(next.track.youtubeId, 0);
        } else {
          pendingPlay.current = { videoId: next.track.youtubeId, start: 0 };
        }
      }
    },
    [getChannel],
  );

  const [state, setState] = useState<NowPlaying | null>(null);

  useEffect(() => {
    const ch = getChannel(channels[0].id);
    const station = { id: ch.id, name: ch.name, tagline: ch.tagline, tracks: ch.tracks };
    const initial = nowPlaying(station);
    setState(initial);
    queue.current = shuffledQueue(initial.total, initial.index);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    history.current = [];
    failures.current = 0;
    const ch = getChannel(channelId);
    const station = { id: ch.id, name: ch.name, tagline: ch.tagline, tracks: ch.tracks };
    const initial = nowPlaying(station);
    setState(initial);
    queue.current = shuffledQueue(initial.total, initial.index);
    setElapsed(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, [playing]);

  const setVolume = useCallback((next: number) => {
    volume.current = next;
    handle.current?.setVolume(next);
  }, []);

  const onReady = useCallback(
    (h: PlayerHandle) => {
      handle.current = h;
      h.setVolume(volume.current);
      playerReady.current = true;
      if (pendingPlay.current) {
        h.play(pendingPlay.current.videoId, pendingPlay.current.start);
        pendingPlay.current = null;
      }
    },
    [],
  );

  const next = useCallback(() => {
    if (state) history.current.push(state.index);
    const upcoming = queue.current.shift();
    if (upcoming === undefined) {
      load(undefined, true);
      return;
    }
    load(upcoming, true);
  }, [load, state]);

  const previous = useCallback(() => {
    if (elapsed > 3 || history.current.length === 0) {
      if (state) load(state.index, true);
      return;
    }
    const back = history.current.pop();
    if (state) queue.current.unshift(state.index);
    if (back !== undefined) load(back, true);
  }, [elapsed, load, state]);

  const onEnded = useCallback(() => {
    if (advancing.current) return;
    advancing.current = true;
    failures.current = 0;
    next();
  }, [next]);

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
    if (state) {
      if (playerReady.current) {
        handle.current?.play(state.track.youtubeId, 0);
      } else {
        pendingPlay.current = { videoId: state.track.youtubeId, start: 0 };
      }
    }
  };

  const togglePlay = () => {
    if (playing) handle.current?.pause();
    else handle.current?.resume();
  };

  const channel = getChannel(channelId);
  const current = state?.track;
  const progress = current ? Math.min(100, (elapsed / current.durationSec) * 100) : 0;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center gap-8 px-4 py-10">
      <header className="text-center">
        <h1 className="font-mono text-3xl font-black tracking-[0.2em] text-amber-300 drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] sm:text-5xl">
          DESI SONGLOON
        </h1>
        <p className="mt-2 text-sm text-amber-100/70 sm:text-base">{channel.tagline}</p>
      </header>

      <div className="my-auto w-full max-w-3xl">
        <nav className="mb-4 flex flex-wrap justify-center gap-2">
          {channels.map((option) => (
            <button
              key={option.id}
              onClick={() => setChannelId(option.id)}
              className={`rounded-full border px-4 py-1.5 text-xs tracking-wide transition-all duration-150 active:scale-95 sm:text-sm ${
                option.id === channelId
                  ? "border-white/70 bg-white/85 text-stone-900"
                  : "border-white/25 bg-white/10 text-white/80 hover:bg-white/20"
              }`}
              aria-pressed={option.id === channelId}
            >
              {option.name}
            </button>
          ))}
        </nav>

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
              {current?.title}
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
            onClick={previous}
            className="hidden shrink-0 rounded-full p-2 text-white/80 transition-all duration-150 hover:text-white active:scale-90 sm:block"
            aria-label="Previous song"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current">
              <path d="M7 5h2v14H7zM19 5v14l-9-7z" />
            </svg>
          </button>

          <button
            onClick={tunedIn ? togglePlay : startListening}
            className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white/90 text-stone-900 shadow-lg transition-all duration-150 hover:bg-white active:scale-90 sm:h-16 sm:w-16"
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

          <button
            onClick={next}
            className="hidden shrink-0 rounded-full p-2 text-white/80 transition-all duration-150 hover:text-white active:scale-90 sm:block"
            aria-label="Next song"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current">
              <path d="M15 5h2v14h-2zM5 5v14l9-7z" />
            </svg>
          </button>

          <VolumeControl initial={volume.current} onChange={setVolume} />
        </div>

        {error && <p className="mt-3 text-center text-xs text-red-300">{error}</p>}
      </div>

      <div className="pointer-events-none fixed -left-[9999px] top-0 h-[240px] w-[320px]">
        <YouTubePlayer
          onReady={onReady}
          onEnded={onEnded}
          onError={onError}
          onPlayingChange={setPlaying}
        />
      </div>

      <footer className="mt-auto pb-6 text-center text-xs text-white/40">
        Contact for Support -{" "}
        <a href="mailto:pratikppc12@gmail.com" className="underline hover:text-white/70 transition-colors duration-150">
          pratikppc12@gmail.com
        </a>
      </footer>
    </div>
  );
}
