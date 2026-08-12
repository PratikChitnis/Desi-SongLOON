"use client";

import { useEffect, useState } from "react";
import {
  currentBackdrop,
  msUntilNextBackdrop,
  type Backdrop as BackdropTheme,
} from "@/lib/backdrops";

/**
 * Full-bleed animated scene behind the player. The theme is derived from the
 * clock (not random) so it matches for every listener, and swaps itself when
 * the current block ends without needing a reload.
 */
export default function Backdrop({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<BackdropTheme>(() => currentBackdrop());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    // Re-read on mount in case the server rendered just before a rotation.
    setTheme(currentBackdrop());
    const schedule = () => {
      timer = setTimeout(() => {
        setTheme(currentBackdrop());
        schedule();
      }, msUntilNextBackdrop() + 1000);
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        key={theme.id}
        className="backdrop-scene absolute inset-0 -z-20"
        style={{ background: theme.layers.join(", ") }}
      />
      <div className="backdrop-grain absolute inset-0 -z-10" />
      <div className="relative z-0">{children}</div>
      <p className="pointer-events-none absolute bottom-3 right-4 z-0 font-mono text-[10px] uppercase tracking-[0.3em] text-white/25">
        {theme.name}
      </p>
    </div>
  );
}
