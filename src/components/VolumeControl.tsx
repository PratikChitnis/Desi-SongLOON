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

  return (
    <div className="hidden items-center gap-3 pr-1 transition-all duration-150 sm:flex">
      <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 fill-white/80">
        <path d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z" />
      </svg>
      <input
        type="range"
        min={0}
        max={100}
        value={volume}
        onChange={(e) => {
          const next = Number(e.target.value);
          setVolume(next);
          onChange(next);
        }}
        className="volume-slider w-24"
        aria-label="Volume"
      />
    </div>
  );
}
