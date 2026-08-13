"use client";

const BAR_COUNT = 16;

export default function Visualizer({
  playing,
  children,
}: {
  playing: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex items-center justify-center">
      {Array.from({ length: BAR_COUNT }, (_, i) => {
        const angle = (360 / BAR_COUNT) * i;
        return (
          <div
            key={i}
            className="viz-bar absolute"
            style={{
              "--angle": `${angle}deg`,
              "--delay": `${(i * 0.08).toFixed(2)}s`,
              animationPlayState: playing ? "running" : "paused",
            } as React.CSSProperties}
          />
        );
      })}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
