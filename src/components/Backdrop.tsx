"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  backdrops,
  currentBackdrop,
  msUntilNextBackdrop,
  type Backdrop as BackdropTheme,
} from "@/lib/backdrops";

/**
 * Full-bleed photographic scene behind the player. The image is derived from the
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
      {/* All scenes stay mounted and cross-fade, so a rotation never flashes black. */}
      {backdrops.map((scene) => (
        <div
          key={scene.id}
          className={`backdrop-scene absolute inset-0 -z-20 transition-opacity duration-[2500ms] ${
            scene.id === theme.id ? "opacity-100" : "opacity-0"
          }`}
        >
          <Image
            src={scene.src}
            alt=""
            fill
            priority={scene.id === theme.id}
            sizes="100vw"
            className="object-cover blur-[2px] brightness-[0.55] saturate-[1.1]"
          />
        </div>
      ))}

      {/* Darkens the middle of the frame so the song title always reads clearly. */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.72)_0%,rgba(0,0,0,0.5)_45%,rgba(0,0,0,0.7)_100%)]" />
      <div className="backdrop-grain absolute inset-0 -z-10" />

      <div className="relative z-0">{children}</div>
    </div>
  );
}
