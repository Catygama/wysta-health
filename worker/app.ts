// app.wysta.health: serves the Expo web export (static assets) and adds what
// the platform doesn't: HTTP → HTTPS redirect, security headers and long
// caching of hashed files. Everything else is the assets binding as before
// (single-page-application fallback configured in wrangler.jsonc).
import { SECURITY_HEADERS, cacheControlFor } from './headers';

type Env = { ASSETS: { fetch: (request: Request) => Promise<Response> } };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.protocol === 'http:' && url.hostname !== 'localhost') {
      url.protocol = 'https:';
      return Response.redirect(url.toString(), 301);
    }
    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
    const cache = cacheControlFor(url.pathname);
    if (cache && response.ok) headers.set('Cache-Control', cache);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
};
