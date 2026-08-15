"use client";

import Image from "next/image";
import { backdrops } from "@/lib/backdrops";

/**
 * Single full-bleed backdrop behind the player, softly blurred and dimmed so
 * the music card reads clearly no matter what's in the image.
 */
export default function Backdrop({ children }: { children: React.ReactNode }) {
  const scene = backdrops[0];

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 -z-20">
        <Image
          src={scene.src}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover blur-[3px] brightness-[0.6] saturate-[1.1]"
        />
      </div>

      {/* Keeps the middle dark enough that the song title always reads clearly. */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.72)_0%,rgba(0,0,0,0.5)_45%,rgba(0,0,0,0.7)_100%)]" />

      <div className="relative z-0">{children}</div>
    </div>
  );
}
