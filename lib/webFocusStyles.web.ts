// Web only: replace the browser's default focus outline (yellow/orange in some
// browsers) on every text field with the brand focus used by the Input
// component: a thin outline in the text colour plus a soft ring. Uses
// currentColor, so it follows the light/dark theme without extra rules.
// Inputs that draw their own focus state (components/ui/Input) set inline
// outline/box-shadow styles, which take precedence over these.
//
// Buttons and links (React Native Web renders Pressable as role="button" and
// links as <a>/role="link") get a 2px ring in the theme's ink colour, set by
// ThemeProvider through --wysta-focus (WCAG 2.4.7 Focus Visible).
const CSS = `
input:focus, textarea:focus, select:focus { outline: none; }
[role="button"]:focus-visible, [role="link"]:focus-visible, a:focus-visible,
[role="tab"]:focus-visible, [role="checkbox"]:focus-visible, [role="radio"]:focus-visible,
[role="switch"]:focus-visible, [role="menuitem"]:focus-visible {
  outline: 2px solid var(--wysta-focus, #50000D) !important;
  outline-offset: 2px;
}
input:focus-visible, textarea:focus-visible {
  outline: 1.5px solid currentColor;
  outline-offset: 0;
  box-shadow: 0 0 0 4px color-mix(in srgb, currentColor 14%, transparent);
}
`;

if (typeof document !== 'undefined' && !document.getElementById('wysta-focus-styles')) {
  const style = document.createElement('style');
  style.id = 'wysta-focus-styles';
  style.textContent = CSS;
  document.head.appendChild(style);
}

export function setWebFocusColor(color: string): void {
  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--wysta-focus', color);
  }
}
