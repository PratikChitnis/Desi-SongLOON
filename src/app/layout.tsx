import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { metadata as siteMeta, site } from "@/lib/config";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: siteMeta.title,
  description: siteMeta.description,
  openGraph: {
    title: siteMeta.ogTitle,
    description: siteMeta.ogDescription,
    type: "website",
    images: [{ url: "/api/now-playing/og", width: 1200, height: 630, alt: "Desi SongLOON" }],
  },
  twitter: {
    card: "summary_large_image",
    title: siteMeta.ogTitle,
    description: siteMeta.ogDescription,
    images: ["/api/now-playing/og"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={site.lang}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
