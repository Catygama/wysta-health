// Web only: paint the page behind the app and the browser chrome (Safari's
// status bar area and toolbar tint, Android's address bar) in the theme
// background. public/index.html sets the same colours from
// prefers-color-scheme before JS runs; this keeps them right when the user
// picks light or dark explicitly in the app.
export function setWebChrome(scheme: 'light' | 'dark', background: string): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.colorScheme = scheme;
  root.style.backgroundColor = background;
  document.body.style.backgroundColor = background;

  // One unconditional theme-color tag replaces the media-query pair from the
  // HTML template, so an explicit choice wins over the system setting.
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
  const meta = document.createElement('meta');
  meta.name = 'theme-color';
  meta.content = background;
  document.head.appendChild(meta);
}
