import { convexAuth } from '@convex-dev/auth/server';
import { Password } from '@convex-dev/auth/providers/Password';
import { Anonymous } from '@convex-dev/auth/providers/Anonymous';

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  // Anonymous is used for "guest" sessions during testing. Disable in
  // production by removing the provider or gating the UI via
  // EXPO_PUBLIC_GUEST_AUTH on the client.
  providers: [Password, Anonymous],
});
