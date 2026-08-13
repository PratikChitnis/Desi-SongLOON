import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev badge overlaps the station UI in the bottom-left corner.
  devIndicators: false,
  images: {
    // Album art for the now-playing card comes from YouTube's thumbnail CDN.
    remotePatterns: [{ protocol: "https", hostname: "i.ytimg.com", pathname: "/vi/**" }],
  },
};

export default nextConfig;
