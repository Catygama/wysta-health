import { useConvexAuth, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

export function useCurrentUser() {
  // Gate on the auth state: on page load the stored token is restored
  // asynchronously, and a currentUser query sent before that resolves to null,
  // which would bounce a signed-in user to the login screen.
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const queried = useQuery(api.users.currentUser, isAuthenticated ? {} : 'skip');
  const user = isAuthenticated ? queried : authLoading ? undefined : null;
  const isLoading = user === undefined;
  const role = user?.profile?.role ?? null;
  return { user, isLoading, role };
}
