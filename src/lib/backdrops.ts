/**
 * Single fixed backdrop behind the player.
 */
export interface Backdrop {
  id: string;
  name: string;
  src: string;
}

export const backdrops: Backdrop[] = [
  { id: "bg", name: "Backdrop", src: "/backdrops/bg.png" },
];
