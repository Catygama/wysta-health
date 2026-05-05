import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useAuthActions } from '@convex-dev/auth/react';

// Exposes window.__E2E_AUTH__ when EXPO_PUBLIC_E2E=true. Lets Playwright
// drive sign-in / sign-up programmatically without UI. Renders nothing.
//
// The bridge is mounted unconditionally in app/_layout.tsx but stays inert
// (no global side effect) unless the env flag is set, so production builds
// see no impact.
export function E2EBridge() {
  const { signIn, signOut } = useAuthActions();

  useEffect(() => {
    if (process.env.EXPO_PUBLIC_E2E !== 'true') return;
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined') return;

    (window as any).__E2E_AUTH__ = {
      signIn: async (email: string, password: string) => {
        await signIn('password', { email, password, flow: 'signIn' });
      },
      signUp: async (email: string, password: string) => {
        await signIn('password', { email, password, flow: 'signUp' });
      },
      signOut: async () => {
        await signOut();
      },
    };
    (window as any).__E2E_READY__ = true;

    return () => {
      delete (window as any).__E2E_AUTH__;
      delete (window as any).__E2E_READY__;
    };
  }, [signIn, signOut]);

  return null;
}
