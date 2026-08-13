"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  BACKDROP_MINUTES,
  backdrops,
  shuffleBackdrops,
  type Backdrop as BackdropTheme,
} from "@/lib/backdrops";

const LAST_SCENE_KEY = "songloon:last-backdrop";

/**
 * Full-bleed photographic scene behind the player. The order is shuffled on the
 * client for every visit — skipping whichever scene opened the previous visit —
 * and steps to the next scene every half hour without needing a reload.
 */
export default function Backdrop({ children }: { children: React.ReactNode }) {
  // Chosen after mount: a server-rendered pick would be identical every visit.
  const [theme, setTheme] = useState<BackdropTheme | null>(null);

  useEffect(() => {
    const previous = window.localStorage.getItem(LAST_SCENE_KEY) ?? undefined;
    const order = shuffleBackdrops(previous);
    window.localStorage.setItem(LAST_SCENE_KEY, order[0].id);

    let at = 0;
    setTheme(order[0]);

    const timer = setInterval(
      () => {
        at = (at + 1) % order.length;
        setTheme(order[at]);
        window.localStorage.setItem(LAST_SCENE_KEY, order[at].id);
      },
      BACKDROP_MINUTES * 60_000,
    );

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* All scenes stay mounted and cross-fade, so a rotation never flashes black. */}
      {backdrops.map((scene) => (
        <div
          key={scene.id}
          className={`backdrop-scene absolute inset-0 -z-20 transition-opacity duration-[2500ms] ${
            scene.id === theme?.id ? "opacity-100" : "opacity-0"
          }`}
        >
          <Image
            src={scene.src}
            alt=""
            fill
            priority
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
