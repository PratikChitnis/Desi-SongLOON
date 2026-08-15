import { ImageResponse } from "next/og";
import { getStation, onAir } from "@/lib/radio";
import { site } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const WIDTH = 1200;
const HEIGHT = 630;

const AMBER = "#fcd34d";

interface LoadedFont {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 700;
  style: "normal";
}

// module-level cache so we fetch Google Fonts once per server instance
let fontCache: LoadedFont[] | null = null;

/** Fetch a font binary (TTF) from Google Fonts. */
async function loadFont(family: string, weight: 400 | 700): Promise<LoadedFont> {
  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
    family,
  )}:wght@${weight}&display=swap`;
  // A "curl" UA makes Google return the TTF (woff2 otherwise breaks some
  // rasterizers).
  const css = await (
    await fetch(cssUrl, {
      headers: { "User-Agent": "curl/7.68.0" },
    })
  ).text();
  const match = css.match(/url\((https:\/\/[^)]+\.ttf)\)/);
  if (!match) throw new Error(`No TTF found for ${family} ${weight}`);
  const ttf = await (await fetch(match[1])).arrayBuffer();
  return { name: family, data: ttf, weight, style: "normal" };
}

async function getFonts(): Promise<LoadedFont[]> {
  if (fontCache) return fontCache;
  const [sans400, sans700, deva400, deva700] = await Promise.all([
    loadFont("Noto Sans", 400),
    loadFont("Noto Sans", 700),
    loadFont("Noto Sans Devanagari", 400),
    loadFont("Noto Sans Devanagari", 700),
  ]);
  fontCache = [sans400, sans700, deva400, deva700];
  return fontCache;
}

/** Trim a long title to fit two lines of the card. */
function fitTitle(title: string, max = 64): string {
  if (title.length <= max) return title;
  return `${title.slice(0, max - 1).trimEnd()}…`;
}

export async function GET(req: Request) {
  // Optional query params let the client render the card for the exact track
  // currently playing in their browser (not just the global on-air track).
  const url = new URL(req.url);
  const qVideoId = url.searchParams.get("videoId");
  const qTitle = url.searchParams.get("title");
  const qFilm = url.searchParams.get("film");
  const qYear = url.searchParams.get("year");

  const station = await getStation();
  const air = onAir(station, Date.now());

  const track = qVideoId
    ? {
        youtubeId: qVideoId,
        title: qTitle ?? "",
        film: qFilm ?? "",
        year: qYear ? Number(qYear) || 0 : 0,
      }
    : air?.track;

  const fonts = await getFonts();
  const fontFamily = `'Noto Sans', 'Noto Sans Devanagari'`;

  // Thumbnail: mqdefault is small (320px) and near-always present.
  const thumb = track ? `https://i.ytimg.com/vi/${track.youtubeId}/mqdefault.jpg` : null;

  const title = track ? fitTitle(track.title) : "Tune in — the 90s are on";
  const meta = track
    ? [track.film || null, track.year || null].filter(Boolean).join(" · ") || "90s Bollywood"
    : "90s Bollywood, 24/7";

  return new ImageResponse(
    (
      <div
        style={{
          width: WIDTH,
          height: HEIGHT,
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          fontFamily,
          background: "linear-gradient(135deg, #0b0a12 0%, #17121f 45%, #241a30 100%)",
          color: "#ffffff",
          position: "relative",
        }}
      >
        {/* neon ring */}
        <div
          style={{
            position: "absolute",
            inset: 18,
            border: `3px solid ${AMBER}`,
            borderRadius: 28,
            boxShadow: "0 0 46px rgba(252,211,77,0.35), inset 0 0 46px rgba(252,211,77,0.10)",
          }}
        />

        {/* header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "44px 56px 0 56px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span
              style={{
                fontSize: 40,
                fontWeight: 700,
                letterSpacing: 6,
                color: AMBER,
              }}
            >
              {site.title.toUpperCase()}
            </span>
            <span style={{ fontSize: 22, color: "#e7e5e4", letterSpacing: 1, marginTop: 4 }}>
              {site.tagline}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "rgba(252,211,77,0.15)",
              border: `1px solid rgba(252,211,77,0.6)`,
              borderRadius: 999,
              padding: "10px 22px",
            }}
          >
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: 999,
                background: "#ef4444",
                boxShadow: "0 0 12px #ef4444",
              }}
            />
            <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: 3, color: AMBER }}>
              LIVE
            </span>
          </div>
        </div>

        {/* body */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 48,
            padding: "40px 64px",
            flex: 1,
          }}
        >
          {thumb ? (
            <img
              src={thumb}
              width={300}
              height={225}
              alt=""
              style={{ borderRadius: 20, border: `2px solid rgba(252,211,77,0.55)`, objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                width: 300,
                height: 225,
                borderRadius: 20,
                background: "rgba(255,255,255,0.08)",
                border: `2px solid rgba(252,211,77,0.4)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ fontSize: 72 }}>🎵</span>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 20, letterSpacing: 4, color: "#a8a29e", marginBottom: 10 }}>
              NOW PLAYING
            </span>
            <span
              style={{
                fontSize: 46,
                fontWeight: 700,
                lineHeight: 1.12,
                color: "#ffffff",
                textShadow: "0 2px 20px rgba(0,0,0,0.6)",
              }}
            >
              {title}
            </span>
            <span style={{ fontSize: 28, color: AMBER, marginTop: 14, fontWeight: 700 }}>{meta}</span>
          </div>
        </div>

        {/* footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 56px 40px 56px",
          }}
        >
          <span style={{ fontSize: 20, color: "#a8a29e" }}>desisongloon.com</span>
          <span style={{ fontSize: 20, color: "#a8a29e", letterSpacing: 1 }}>
            INSTAGRAM · WHATSAPP · 24/7
          </span>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      fonts,
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
