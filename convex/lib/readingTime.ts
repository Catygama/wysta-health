// Reading time shown on an article ("5 min de leitura"), from its word count.
// Shared by the server (saved on the article) and the admin editor (live).
const WORDS_PER_MINUTE = 200;

export function readingTimeFor(...texts: (string | undefined)[]): number {
  const words = texts.join(' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
