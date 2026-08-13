"use client";

import { useState } from "react";

/**
 * Keeps the slider position in its own state: dragging then re-renders one
 * input instead of the whole station, which is what made the drag feel sticky.
 */
export default function VolumeControl({
  initial,
  onChange,
}: {
  initial: number;
  onChange: (volume: number) => void;
}) {
  const [volume, setVolume] = useState(initial);
  const [muted, setMuted] = useState(false);
  const [saved, setSaved] = useState(initial);

  const toggleMute = () => {
    if (muted) {
      setMuted(false);
      setVolume(saved);
      onChange(saved);
    } else {
      setMuted(true);
      setSaved(volume);
      setVolume(0);
      onChange(0);
    }
  };

  return (
    <div className="hidden items-center gap-3 pr-1 transition-all duration-150 sm:flex">
      <button
        onClick={toggleMute}
        className="shrink-0 rounded-full p-1 transition-all duration-150 hover:bg-white/10 active:scale-90"
        aria-label={muted ? "Unmute" : "Mute"}
      >
        {muted || volume === 0 ? (
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white/80">
            <path d="M4 9v6h4l5 4V5L8 9H4zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white/80">
            <path d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z" />
          </svg>
        )}
      </button>
      <input
        type="range"
        min={0}
        max={100}
        value={volume}
        onChange={(e) => {
          const next = Number(e.target.value);
          setVolume(next);
          setMuted(next === 0);
          onChange(next);
        }}
        className="volume-slider w-24"
        aria-label="Volume"
      />
    </div>
  );
}
