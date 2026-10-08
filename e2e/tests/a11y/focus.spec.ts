import { test, expect } from '@playwright/test';
import { gotoApp } from '../../helpers/auth';

// WCAG 2.4.7: buttons and links show a visible focus ring when reached with
// the keyboard, not only text fields.
test('keyboard focus on buttons and links is visible', async ({ page }) => {
  await gotoApp(page, '/(auth)/login');
  const seen = new Set<string>();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    const focus = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return null;
      const role = el.getAttribute('role') ?? el.tagName.toLowerCase();
      const cs = getComputedStyle(el);
      return { role, outlineStyle: cs.outlineStyle, outlineWidth: cs.outlineWidth };
    });
    if (focus && (focus.role === 'button' || focus.role === 'link' || focus.role === 'a')) {
      expect(focus.outlineStyle, `${focus.role} focus`).toBe('solid');
      expect(focus.outlineWidth).toBe('2px');
      seen.add(focus.role);
    }
  }
  expect(seen.has('button')).toBe(true);
});
