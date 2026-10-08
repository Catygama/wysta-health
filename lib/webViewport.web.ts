// Web only: keep the app the size of what is actually visible.
//
// iPhone Safari doesn't resize the page when the keyboard opens; it shrinks
// the visual viewport and scrolls the whole document up to reveal the focused
// field, which pushes headers off the top and leaves a gap under the
// composer. Here the page height follows window.visualViewport (published as
// --wysta-vh, used by public/index.html and the web layouts) and the document
// scroll Safari adds is undone, so the layout stays put and the composer sits
// right above the keyboard. Desktop browsers report the window height, so
// nothing changes there.
function sync() {
  const vv = window.visualViewport;
  if (!vv) return;
  // Pinch-zoom also shrinks the visual viewport; only follow it at 1x.
  if (Math.abs(vv.scale - 1) > 0.01) return;
  document.documentElement.style.setProperty('--wysta-vh', `${Math.round(vv.height)}px`);
  if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo(0, 0);
}

if (typeof window !== 'undefined' && window.visualViewport) {
  window.visualViewport.addEventListener('resize', sync);
  window.visualViewport.addEventListener('scroll', sync);
  window.addEventListener('orientationchange', sync);
  sync();
}

export {};
