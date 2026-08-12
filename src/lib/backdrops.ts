/**
 * Retro backdrops rotate on the station clock, so every listener sees the same
 * scene at the same time and it changes a few times through the day.
 */
export const BACKDROP_HOURS = 4;

export interface Backdrop {
  id: string;
  name: string;
  src: string;
}

export const backdrops: Backdrop[] = [
  { id: "study-desk", name: "Study Desk", src: "/backdrops/study-desk.jpg" },
  { id: "walkman-sunset", name: "Walkman Sunset", src: "/backdrops/walkman-sunset.jpg" },
  { id: "delhi-platform", name: "Delhi Platform", src: "/backdrops/delhi-platform.jpg" },
  { id: "night-bazaar", name: "Night Bazaar", src: "/backdrops/night-bazaar.jpg" },
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
