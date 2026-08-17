"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import VolumeControl from "./VolumeControl";
import YouTubePlayer, { type PlayerHandle } from "./YouTubePlayer";
import { nowPlaying } from "@/lib/scheduler";
import { player, site } from "@/lib/config";
import type { NowPlaying, Track } from "@/lib/types";

/** Seconds as m:ss for the now-playing readout. */
function clock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

/** Four bars that dance only while the station is playing. */
function Equalizer({ playing }: { playing: boolean }) {
  const bars = [0, 1, 2, 3];
  return (
    <span aria-hidden className={`flex h-4 shrink-0 items-end gap-[3px] ${playing ? "" : "opacity-40"}`}>
      {bars.map((i) => (
        <span
          key={i}
          className="eq-bar w-[3px] rounded-full bg-amber-300/90"
          style={
            {
              height: `${[0.5, 0.85, 0.65, 1][i] * 16}px`,
              "--eq-dur": `${0.7 + (i % 3) * 0.25}s`,
              "--eq-delay": `${i * 0.15}s`,
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}

/** Stable device id shared by the listener feed and the visit counter. */
function getSessionId(): string {
  try {
    let s = localStorage.getItem("desi-songloon:listener");
    if (!s) {
      s = `v1-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem("desi-songloon:listener", s);
    }
    return s;
  } catch {
    return `v1-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

/** Live concurrent listener count, streamed from the /api/listeners SSE feed.
 *  Only listeners who are actually playing are counted.  The green dot is the
 *  viewer's own status: green while playing and connected, gray otherwise. */
function ListenersCount({ playing }: { playing: boolean }) {
  const [count, setCount] = useState<number | null>(null);
  const [online, setOnline] = useState(false);
  const playingRef = useRef(playing);
  playingRef.current = playing;

  /** Tell the server whether this device is playing right now. */
  const report = useCallback((p: boolean) => {
    const session = getSessionId();
    fetch(`/api/listeners?session=${encodeURIComponent(session)}&playing=${p ? "1" : "0"}`, { method: "POST" }).catch(
      () => {
        // best effort — the next state change retries
      },
    );
  }, []);

  useEffect(() => {
    const session = getSessionId();
    const es = new EventSource(`/api/listeners?session=${encodeURIComponent(session)}`);
    es.onopen = () => {
      setOnline(true);
      report(playingRef.current);
    };
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as { count?: number };
        if (typeof data.count === "number") setCount(data.count);
      } catch {
        // ignore malformed frames
      }
    };
    es.onerror = () => setOnline(false);
    return () => es.close();
  }, [report]);

  // Reflect play/pause immediately (also corrects the server's default).
  useEffect(() => {
    report(playing);
  }, [playing, report]);

  const active = online && playing;
  // Shows "—" until the first real count arrives (always rendered, so the
  // stat is findable even before the feed connects).
  return (
    <p className="mt-2 flex items-center justify-center gap-2 text-xs text-white/60 sm:text-sm">
      <span className="relative flex h-2 w-2">
        <span
          className={`absolute inline-flex h-full w-full animate-ping rounded-full ${active ? "bg-emerald-400 opacity-60" : "bg-white/30 opacity-40"}`}
        />
        <span className={`relative inline-flex h-2 w-2 rounded-full ${active ? "bg-emerald-400" : "bg-white/30"}`} />
      </span>
      <span className="tabular-nums">{count === null ? "—" : count.toLocaleString("en-US")}</span> people listening now
    </p>
  );
}

/** Total unique visitors since the counter started (persisted server-side). */
function TotalVisits() {
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    const session = getSessionId();
    let cancelled = false;
    fetch(`/api/visits?session=${encodeURIComponent(session)}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ total: number }>) : null))
      .then((data) => {
        if (!cancelled && data) setTotal(data.total);
      })
      .catch(() => {
        // leave hidden if the endpoint is unreachable
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Always rendered — "—" until the counter reports a real number.
  return (
    <p className="mt-2 flex items-center justify-center">
      <span className="rounded-full bg-white/20 px-3 py-1.5 text-xs text-white/50 shadow-sm backdrop-blur-sm sm:text-sm">
        <span className="tabular-nums">{total === null ? "—" : total.toLocaleString("en-US")}</span> total visits
      </span>
    </p>
  );
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

  const [tunedIn, setTunedIn] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handle = useRef<PlayerHandle | null>(null);
  const failures = useRef(0);
  const volume = useRef(player.defaultVolume);
  const queue = useRef<number[]>([]);
  const history = useRef<number[]>([]);

  const stateRef = useRef<NowPlaying | null>(null);
  const tunedInRef = useRef(false);

  // Silent audio keep-alive — prevents mobile browsers from suspending the tab
  // when the screen locks.  A Web Audio oscillator playing silence at inaudible
  // volume keeps the audio context active so the OS treats this as active media.
  useEffect(() => {
    if (!playing) return;
    let ctx: AudioContext | null = null;
    let node: GainNode | null = null;
    let osc: OscillatorNode | null = null;
    try {
      ctx = new AudioContext();
      node = ctx.createGain();
      node.gain.value = 0; // silent
      osc = ctx.createOscillator();
      osc.connect(node);
      node.connect(ctx.destination);
      osc.start();
      // Resume context if suspended (autoplay policy)
      if (ctx.state === "suspended") ctx.resume();
    } catch { /* Web Audio not supported — graceful degradation */ }
    return () => {
      try { osc?.stop(); } catch {}
      try { ctx?.close(); } catch {}
    };
  }, [playing]);

  /** Whether the player has fired onReady yet. */
  const playerReady = useRef(false);
  /** Queued play command, executed once the player fires onReady. */
  const pendingPlay = useRef<{ videoId: string; start: number } | null>(null);
  /** Guard against rapid duplicate onEnded fires. */
  const advancing = useRef(false);

  const [timeStr, setTimeStr] = useState("");
  const [showAbout, setShowAbout] = useState(false);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  const channel = channelsRef.current[0];

  const [state, setStateRaw] = useState<NowPlaying | null>(null);

  const setState = useCallback((next: NowPlaying | null) => {
    stateRef.current = next;
    setStateRaw(next);
  }, []);

  const load = useCallback(
    (index: number | undefined, autoplay: boolean) => {
      const ch = channelsRef.current[0];
      const station = { id: ch.id, name: ch.name, tagline: ch.tagline, tracks: ch.tracks };
      const next = nowPlaying(station, index);
      if (!next) {
        setError("No tracks available for this channel.");
        setState(null);
        return;
      }
      // Build queue from daily order: every position after the current one,
      // wrapping around. Positions (not track indices) so nowPlaying() treats
      // them as order positions consistently with playback.
      if (index === undefined) {
        queue.current = Array.from({ length: next.total - 1 }, (_, k) => (next.index + 1 + k) % next.total);
      }
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
      } else if (playerReady.current) {
        handle.current?.cue(next.track.youtubeId);
      }
    },
    [setState],
  );

  useEffect(() => {
    history.current = [];
    failures.current = 0;
    const ch = channelsRef.current[0];
    const station = { id: ch.id, name: ch.name, tagline: ch.tagline, tracks: ch.tracks };
    const initial = nowPlaying(station);
    if (initial) {
      setState(initial);
      queue.current = Array.from({ length: initial.total - 1 }, (_, k) => (initial.index + 1 + k) % initial.total);
      setElapsed(0);
      if (tunedInRef.current) {
        if (playerReady.current) {
          handle.current?.play(initial.track.youtubeId, 0);
        } else {
          pendingPlay.current = { videoId: initial.track.youtubeId, start: 0 };
        }
      } else if (playerReady.current) {
        handle.current?.cue(initial.track.youtubeId);
      }
    } else {
      setState(null);
      setError("No tracks available for this channel.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, [playing]);

  // Media Session API — keeps audio alive when the screen locks or the browser
  // goes to the background on mobile.  Registers track metadata so the OS
  // shows proper lock-screen / notification controls.
  useEffect(() => {
    const ms = navigator.mediaSession;
    if (!ms) return;
    if (state) {
      ms.metadata = new MediaMetadata({
        title: state.track.title,
        artist: state.track.film || "Desi SongLOON",
        album: "Desi SongLOON — 90s Bollywood",
        artwork: [
          { src: `https://i.ytimg.com/vi/${state.track.youtubeId}/mqdefault.jpg`, sizes: "320x180", type: "image/jpeg" },
        ],
      });
    }
    ms.setActionHandler("play", () => { startListening(); });
    ms.setActionHandler("pause", () => { if (tunedInRef.current) togglePlay(); });
    ms.setActionHandler("previoustrack", () => { previous(); });
    ms.setActionHandler("nexttrack", () => { next(); });
    return () => {
      ms.setActionHandler("play", null);
      ms.setActionHandler("pause", null);
      ms.setActionHandler("previoustrack", null);
      ms.setActionHandler("nexttrack", null);
    };
  }, [state, playing]);

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
      } else {
        const s = stateRef.current;
        if (s) h.cue(s.track.youtubeId);
      }
    },
    [],
  );

  const next = useCallback(() => {
    const s = stateRef.current;
    if (s) history.current.push(s.index);
    const upcoming = queue.current.shift();
    if (upcoming === undefined) {
      // Queue exhausted — wrap around in daily order without rebuilding queue
      const nextIdx = (s ? s.index + 1 : 0) % s!.total;
      const ch = channelsRef.current[0];
      const track = ch.tracks[s!.order[nextIdx]];
      const newState: NowPlaying = { track, index: nextIdx, total: s!.total, order: s!.order };
      setError(null);
      setElapsed(0);
      advancing.current = false;
      setState(newState);
      if (playerReady.current) {
        handle.current?.play(track.youtubeId, 0);
      } else {
        pendingPlay.current = { videoId: track.youtubeId, start: 0 };
      }
      return;
    }
    load(upcoming, true);
  }, [load, setState]);

  const previous = useCallback(() => {
    const s = stateRef.current;
    if (elapsed > player.previousThresholdSec || history.current.length === 0) {
      if (s) load(s.index, true);
      return;
    }
    const back = history.current.pop();
    if (s) queue.current.unshift(s.index);
    if (back !== undefined) load(back, true);
  }, [elapsed, load]);

  const onEnded = useCallback(() => {
    if (advancing.current) return;
    advancing.current = true;
    failures.current = 0;
    next();
  }, [next]);

  const onError = useCallback(() => {
    failures.current += 1;
    if (failures.current > player.maxFailures) {
      setError("Several tracks in a row are unavailable here. Try again later.");
      return;
    }
    setError("That track is unavailable — skipping ahead.");
    next();
  }, [next]);

  const startListening = () => {
    setTunedIn(true);
    tunedInRef.current = true;
    setPlaying(true);
    failures.current = 0;
    const s = stateRef.current;
    if (s) {
      if (playerReady.current) {
        handle.current?.playInstant();
      } else {
        pendingPlay.current = { videoId: s.track.youtubeId, start: 0 };
      }
    }
  };

  const togglePlay = () => {
    if (playing) {
      handle.current?.pause();
      setPlaying(false);
    } else {
      handle.current?.resume();
      setPlaying(true);
    }
  };

  const current = state?.track;
  const progress = current ? Math.min(100, (elapsed / current.durationSec) * 100) : 0;

  const upNext = useMemo(() => {
    if (!state || state.total === 0) return [];
    const ch = channelsRef.current[0];
    const out: Track[] = [];
    for (let i = 1; i <= 5; i++) {
      out.push(ch.tracks[state.order[(state.index + i) % state.total]]);
    }
    return out;
  }, [state]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center gap-3 px-4 py-3 sm:gap-8 sm:py-10">
      <header className="relative w-full">
        {/* Mobile: pills in normal flow, scroll with page */}
        <div className="flex items-center justify-between px-2 pb-2 sm:hidden">
          <div className="flex items-center gap-1.5">
            <span className="shrink-0 rounded-full bg-white/20 px-2.5 py-1 font-mono text-xs text-white/50 shadow-sm tabular-nums backdrop-blur-sm">
              {timeStr}
            </span>
            <button
              onClick={() => setShowAbout(true)}
              aria-label="About"
              title="About Desi SongLOON"
              className="flex shrink-0 items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-xs text-white/80 shadow-sm backdrop-blur-sm transition-all duration-150 active:scale-95"
            >
              <span className="grid h-4 w-4 place-items-center rounded-full bg-amber-300 text-[10px] font-black leading-none text-stone-900">
                !
              </span>
              About
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <a
              href="https://wa.me/919834119278"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
              title="Chat on WhatsApp"
              className="flex shrink-0 items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-xs shadow-sm backdrop-blur-sm transition-all duration-150 active:scale-95"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4">
                <path fill="#25D366" d="M12 2a10 10 0 0 0-8.6 15L2 22l5.1-1.3A10 10 0 1 0 12 2zm5.8 14.2c-.2.7-1.3 1.3-1.9 1.4-.5.1-1.1.1-1.8-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5.1-4.5-.1-.2-1.2-1.6-1.2-3.1s.8-2.2 1-2.5c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5.2.5.7 1.8.8 1.9.1.2.1.3 0 .5-.1.2-.1.3-.3.5l-.4.5c-.2.2-.3.3-.1.6.2.2.8 1.3 1.7 2.1 1.2 1.1 2.2 1.4 2.5 1.6.3.1.5.1.7-.1.2-.2.8-.9 1-1.2.2-.3.4-.3.7-.2.3.1 1.7.8 2 1 .3.2.5.2.6.4.1.1.1.7-.1 1.4z" />
              </svg>
              <span className="font-medium text-white/80">WhatsApp</span>
            </a>
          </div>
        </div>

        {/* Desktop: fixed pills — unchanged */}
        <div className="fixed left-3 top-3 hidden items-center gap-2 sm:flex">
          <span className="rounded-full bg-white/20 px-3 py-1.5 font-mono text-sm text-white/50 shadow-sm tabular-nums backdrop-blur-sm sm:text-base">
            {timeStr}
          </span>
          <button
            onClick={() => setShowAbout(true)}
            aria-label="About"
            title="About Desi SongLOON"
            className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-sm text-white/80 shadow-sm backdrop-blur-sm transition-all duration-150 hover:bg-white/40 active:scale-95 sm:text-base"
          >
            <span className="grid h-5 w-5 place-items-center rounded-full bg-amber-300 text-xs font-black leading-none text-stone-900 sm:h-6 sm:w-6">
              !
            </span>
            About
          </button>
        </div>
        <div className="fixed right-3 top-3 hidden items-center gap-2 sm:flex">
          <a
            href="https://wa.me/919834119278"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="WhatsApp"
            title="Chat on WhatsApp"
            className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-sm shadow-sm backdrop-blur-sm transition-all duration-150 hover:bg-white/40 active:scale-95 sm:text-base"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 sm:h-6 sm:w-6">
              <path fill="#25D366" d="M12 2a10 10 0 0 0-8.6 15L2 22l5.1-1.3A10 10 0 1 0 12 2zm5.8 14.2c-.2.7-1.3 1.3-1.9 1.4-.5.1-1.1.1-1.8-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5.1-4.5-.1-.2-1.2-1.6-1.2-3.1s.8-2.2 1-2.5c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5.2.5.7 1.8.8 1.9.1.2.1.3 0 .5-.1.2-.1.3-.3.5l-.4.5c-.2.2-.3.3-.1.6.2.2.8 1.3 1.7 2.1 1.2 1.1 2.2 1.4 2.5 1.6.3.1.5.1.7-.1.2-.2.8-.9 1-1.2.2-.3.4-.3.7-.2.3.1 1.7.8 2 1 .3.2.5.2.6.4.1.1.1.7-.1 1.4z" />
            </svg>
            <span className="font-medium text-white/80">WhatsApp</span>
          </a>
        </div>

        <div className="text-center sm:pt-0">
          <h1 className="font-mono text-3xl font-black tracking-[0.2em] text-amber-300 drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] sm:text-5xl">
            {site.title.toUpperCase()}
          </h1>
          <p className="mt-2 text-sm text-amber-100/70 sm:text-base">{channel.tagline}</p>
          <ListenersCount playing={playing} />
          <TotalVisits />
        </div>
      </header>

      <div className="my-1 w-full max-w-3xl sm:my-auto">
        <div className={`neon-border rounded-[2rem] ${playing ? "is-playing" : ""}`}>
        <div className="glass-card rounded-[2rem] px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex items-center gap-4 sm:gap-6">
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
            <div className="flex items-center gap-3">
              <h2 className="min-w-0 flex-1 truncate text-lg font-semibold text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.7)] sm:text-2xl">
                {current?.title}
              </h2>
              <Equalizer playing={playing} />
            </div>
            <p className="mt-0.5 truncate text-xs text-white/60 sm:text-sm">
              {current
                ? [current.film || null, current.year || null].filter(Boolean).join(" · ") || site.title
                : site.title}
            </p>

            <div className="mt-3 flex items-center gap-3">
              <div
                className="group relative h-2 flex-1 cursor-pointer rounded-full bg-white/20"
                onClick={(e) => {
                  if (!current) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                  const seekTo = Math.floor(pct * current.durationSec);
                  handle.current?.seekTo(seekTo);
                  setElapsed(seekTo);
                }}
              >
                <div
                  className="h-full rounded-full bg-white transition-[width] duration-1000 ease-linear"
                  style={{ width: `${progress}%` }}
                />
                <div className="absolute -top-1 left-0 h-4 w-1 -translate-x-1/2 rounded-full bg-white opacity-0 shadow transition-opacity group-hover:opacity-100"
                  style={{ left: `${progress}%` }}
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

          <div className="mt-3 flex items-center justify-center gap-3 sm:hidden">
            <button
              onClick={previous}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-white/80 transition-all duration-150 active:scale-90"
              aria-label="Previous song"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                <path d="M7 5h2v14H7zM19 5v14l-9-7z" />
              </svg>
            </button>
            <button
              onClick={next}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-white/80 transition-all duration-150 active:scale-90"
              aria-label="Next song"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                <path d="M15 5h2v14h-2zM5 5v14l9-7z" />
              </svg>
            </button>
          </div>
        </div>
        </div>

        {error && <p className="mt-3 text-center text-xs text-red-300">{error}</p>}

        {upNext.length > 0 && (
          <div className="mt-3 sm:mt-5">
            <p className="mb-2 flex items-center gap-3 px-1 font-mono text-[11px] uppercase tracking-[0.25em] text-amber-200/70">
              <span className="h-px flex-1 bg-amber-200/40" />
              Up next on menu
              <span className="h-px flex-1 bg-amber-200/40" />
            </p>
            <ol className="divide-y divide-white/10 rounded-2xl bg-black/25 backdrop-blur-sm">
              {upNext.map((t, i) => (
                <li
                  key={`${t.youtubeId}-${i}`}
                  className="flex items-center gap-3 px-4 py-2.5"
                >
                  <span className="w-5 shrink-0 text-right font-mono text-xs tabular-nums text-white/40">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-white/85">{t.title}</span>
                  <span className="hidden shrink-0 truncate text-[11px] text-white/40 sm:block">
                    {t.film || t.year || ""}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      <div className="pointer-events-none fixed -left-[9999px] top-0 h-[240px] w-[320px]">
        <YouTubePlayer
          onReady={onReady}
          onEnded={onEnded}
          onError={onError}
          onPlayingChange={setPlaying}
        />
      </div>

      <footer className="mt-4 pb-4 text-center text-xs text-white/40 space-y-1 sm:mt-auto sm:pb-6">
        <p>
          All music is the property of their respective owners. No copyright infringement intended.
        </p>
        <p>
          To request removal of any content, contact{" "}
          <a href={`mailto:${site.contactEmail}`} className="underline hover:text-white/70 transition-colors duration-150">
            {site.contactEmail}
          </a>
        </p>
      </footer>

      {showAbout && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setShowAbout(false)}
        >
          <div
            className="glass-card w-full max-w-lg rounded-3xl px-6 py-6 sm:px-8 sm:py-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="font-mono text-xl font-black tracking-widest text-amber-300 sm:text-2xl">
                ABOUT {site.title.toUpperCase()}
              </h2>
              <button
                onClick={() => setShowAbout(false)}
                aria-label="Close"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/15 text-white/80 transition-all duration-150 hover:bg-white/30 active:scale-90"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                  <path d="M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6z" />
                </svg>
              </button>
            </div>

            <div className="space-y-3 text-sm leading-relaxed text-white/80">
              <p>
                {site.title} is a 24/7 internet radio station devoted to the golden era of 90s
                Hindi film music. A single non-stop channel keeps the decade&apos;s greatest melodies
                playing around the clock.
              </p>
              <p>
                Every track is an official record-label upload on YouTube, streamed through the
                YouTube player, so the artists and labels who own the music continue to be
                credited and compensated for every play. No audio is hosted, re-encoded or
                downloaded here.
              </p>
              <p>
                The station runs around the clock from its own cloud server: every listener hears
                the same running order for the day, yet each visit opens on a random track. The
                live listener count and total visits you see are real. Tune in, sit back, and let
                the 90s play.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
