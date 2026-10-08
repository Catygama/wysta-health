// Web haptics. Android browsers have navigator.vibrate. iPhone Safari has no
// Vibration API, but since iOS 18 toggling an <input type="checkbox" switch>
// plays the system haptic, so a hidden one is clicked (same trick as the
// ios-haptics package). Both only work inside the user's tap handler, which is
// where these are called. Desktop browsers do nothing.
function pulse(ms: number) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(ms);
    return;
  }
  if (typeof document === 'undefined') return;
  const label = document.createElement('label');
  label.ariaHidden = 'true';
  label.style.display = 'none';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  label.appendChild(input);
  document.head.appendChild(label);
  label.click();
  label.remove();
}

export const haptics = {
  /** A button or card was pressed. */
  tap: () => pulse(10),
  /** An option was chosen (triage answers, pickers). */
  select: () => pulse(15),
};
