/**
 * Retro backdrops rotate on the station clock, so every listener sees the same
 * scene at the same time and it changes a few times through the day.
 */
export const BACKDROP_HOURS = 2;

export interface Backdrop {
  id: string;
  name: string;
  /** Layered CSS backgrounds painted behind the animated grain/scanlines. */
  layers: string[];
  accent: string;
}

export const backdrops: Backdrop[] = [
  {
    id: "sunset-cassette",
    name: "Sunset Cassette",
    accent: "#fbbf24",
    layers: [
      "radial-gradient(circle at 50% 78%, #fb923c 0%, #ea580c 22%, transparent 60%)",
      "linear-gradient(180deg, #2a1236 0%, #6d1f4a 45%, #b8452f 78%, #f59e0b 100%)",
    ],
  },
  {
    id: "neon-grid",
    name: "Neon Grid",
    accent: "#22d3ee",
    layers: [
      "repeating-linear-gradient(90deg, rgba(34,211,238,0.22) 0 1px, transparent 1px 72px)",
      "repeating-linear-gradient(0deg, rgba(217,70,239,0.18) 0 1px, transparent 1px 72px)",
      "linear-gradient(180deg, #08010f 0%, #2b0b46 60%, #6d28d9 100%)",
    ],
  },
  {
    id: "marigold-mandap",
    name: "Marigold Mandap",
    accent: "#f97316",
    layers: [
      "radial-gradient(circle at 20% 25%, rgba(251,146,60,0.42), transparent 45%)",
      "radial-gradient(circle at 80% 70%, rgba(190,24,93,0.42), transparent 45%)",
      "linear-gradient(140deg, #3b0d18 0%, #7c2d12 55%, #92400e 100%)",
    ],
  },
  {
    id: "vhs-static",
    name: "VHS Static",
    accent: "#a5b4fc",
    layers: [
      "repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0 2px, transparent 2px 5px)",
      "radial-gradient(circle at 65% 35%, rgba(129,140,248,0.35), transparent 55%)",
      "linear-gradient(200deg, #0b1020 0%, #1e1b4b 60%, #312e81 100%)",
    ],
  },
  {
    id: "disco-floor",
    name: "Disco Floor",
    accent: "#f472b6",
    layers: [
      "conic-gradient(from 0deg at 50% 50%, rgba(244,114,182,0.30) 0deg, transparent 40deg, rgba(56,189,248,0.30) 90deg, transparent 140deg, rgba(250,204,21,0.30) 200deg, transparent 260deg, rgba(244,114,182,0.30) 360deg)",
      "linear-gradient(180deg, #10061a 0%, #3b0764 70%, #831843 100%)",
    ],
  },
  {
    id: "monsoon-matinee",
    name: "Monsoon Matinee",
    accent: "#5eead4",
    layers: [
      "repeating-linear-gradient(105deg, rgba(226,232,240,0.10) 0 1px, transparent 1px 22px)",
      "radial-gradient(circle at 35% 20%, rgba(45,212,191,0.28), transparent 55%)",
      "linear-gradient(180deg, #041b1c 0%, #0f3b3d 55%, #134e4a 100%)",
    ],
  },
];

export function currentBackdrop(atMs: number = Date.now()): Backdrop {
  const block = Math.floor(atMs / (BACKDROP_HOURS * 3600_000));
  return backdrops[block % backdrops.length];
}

/** Milliseconds until the backdrop rotates. */
export function msUntilNextBackdrop(atMs: number = Date.now()): number {
  const period = BACKDROP_HOURS * 3600_000;
  return period - (atMs % period);
}
