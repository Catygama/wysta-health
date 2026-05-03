// Read-only client env helpers. Values exposed via EXPO_PUBLIC_* are
// inlined at build time on every platform (web, iOS, Android).

const RAW_GUEST = process.env.EXPO_PUBLIC_GUEST_AUTH;

// Default: empty/unset → enabled. Only the literal "false" or "0"
// disables the guest entry buttons. We intentionally accept the empty
// case as "show" so previews and dev builds offer guest access without
// extra config.
export const guestAuthEnabled =
  RAW_GUEST === undefined ||
  RAW_GUEST === '' ||
  (RAW_GUEST !== 'false' && RAW_GUEST !== '0');
