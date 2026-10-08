import { ConvexError } from 'convex/values';

// What to show the person when something fails. Server messages meant for
// them arrive as ConvexError data (European Portuguese); anything else from
// the server is technical (and English), so it becomes the fallback text.
// Errors raised in the app itself (e.g. picker checks) are shown as they are.
export function errorText(e: unknown, fallback: string): string {
  if (e instanceof ConvexError && typeof e.data === 'string') return e.data;
  // Server errors that aren't ConvexErrors come wrapped as "[CONVEX …]".
  if (e instanceof Error && e.message && !e.message.includes('[CONVEX')) return e.message;
  return fallback;
}
