import { describe, it, expect } from 'vitest';
import worker from '../../worker/app';

const assets = {
  fetch: async (req: Request) =>
    new Response(`asset ${new URL(req.url).pathname}`, { status: 200, headers: { 'Content-Type': 'text/html' } }),
};

describe('app Worker', () => {
  it('redirects HTTP to HTTPS', async () => {
    const res = await worker.fetch(new Request('http://app.wysta.health/queue?x=1'), { ASSETS: assets });
    expect(res.status).toBe(301);
    expect(res.headers.get('Location')).toBe('https://app.wysta.health/queue?x=1');
  });

  it('adds the security headers to every response', async () => {
    const res = await worker.fetch(new Request('https://app.wysta.health/login'), { ASSETS: assets });
    expect(res.status).toBe(200);
    expect(res.headers.get('Strict-Transport-Security')).toContain('max-age=31536000');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(res.headers.get('Content-Security-Policy-Report-Only')).toContain("frame-ancestors 'none'");
    expect(await res.text()).toBe('asset /login');
  });

  it('caches hashed files for a year, not the page', async () => {
    const js = await worker.fetch(new Request('https://app.wysta.health/_expo/static/js/web/index-abc.js'), { ASSETS: assets });
    expect(js.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
    const page = await worker.fetch(new Request('https://app.wysta.health/'), { ASSETS: assets });
    expect(page.headers.get('Cache-Control')).toBeNull();
  });
});
