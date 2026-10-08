// Security headers shared by the app Worker (worker/app.ts). The site
// (wysta.health) sets the same ones in marketing/_headers.
export const SECURITY_HEADERS: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // Report-Only first: the Expo web build injects inline styles and talks to
  // Convex over HTTPS and WebSocket. Violations show in the browser console;
  // switch to Content-Security-Policy once it is clean.
  'Content-Security-Policy-Report-Only': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.convex.cloud",
    "font-src 'self' data:",
    "connect-src 'self' https://*.convex.cloud wss://*.convex.cloud https://*.convex.site",
    "worker-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
};

// Long cache for files whose name carries a content hash (Expo export).
export function cacheControlFor(pathname: string): string | null {
  if (pathname.startsWith('/_expo/static/') || pathname.startsWith('/assets/')) {
    return 'public, max-age=31536000, immutable';
  }
  return null;
}
