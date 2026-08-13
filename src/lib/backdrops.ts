/**
 * Retro backdrops are shuffled per visit, so a listener never opens on the same
 * scene twice in a row, and rotate through that shuffled order every half hour.
 */
import { backdrops as backdropConfig } from "./config";

export const BACKDROP_MINUTES = backdropConfig.rotateMinutes;

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

/** Fisher-Yates copy of the scenes, optionally never starting on `avoid`. */
export function shuffleBackdrops(avoid?: string): Backdrop[] {
  const order = [...backdrops];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  if (avoid && order.length > 1 && order[0].id === avoid) {
    [order[0], order[1]] = [order[1], order[0]];
  }
  return order;
}
