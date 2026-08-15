/**
 * Songs matching any of these patterns are treated as NOT 90s Hindi cinema
 * music.  They are skipped when syncing the playlist, removed by the sync
 * script's `--clean` mode, and excluded from the station at fetch time.
 * Patterns are deliberately loose because titles come from random uploaders.
 */
export const NON_90S_FILTERS: RegExp[] = [
  /haryanvi|haryanavi|\bjaat\b|new\s+haryanvi/i,
  /punjabi|bhojpuri|marathi|gujarati|tamil|telugu|kannada|malayalam|odia|bengali\s+song|assamese/i,
  /\b20(1[0-9]|2[0-9])\b/, // any year 2010+, i.e. not the 90s
  /\bdesi\s+hits?\b/i,
];

export function isNon90s(title: string): boolean {
  return NON_90S_FILTERS.some((re) => re.test(title));
}
