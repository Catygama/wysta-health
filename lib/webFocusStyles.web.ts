// Web only: replace the browser's default focus outline (yellow/orange in some
// browsers) on every text field with the brand focus used by the Input
// component: a thin outline in the text colour plus a soft ring. Uses
// currentColor, so it follows the light/dark theme without extra rules.
// Inputs that draw their own focus state (components/ui/Input) set inline
// outline/box-shadow styles, which take precedence over these.
const CSS = `
input:focus, textarea:focus, select:focus { outline: none; }
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

export {};
