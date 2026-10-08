import { useEffect, useState } from 'react';
import { useConvexAuth, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { PRIVACY_POLICY_VERSION } from '@/constants/privacyPolicy';

type Method = 'registo' | 'sem-conta';

// Records the privacy consent on the server as soon as the new session is
// active (the auth token isn't ready the moment signIn() resolves). Screens
// call markPending() after a successful sign-up / guest entry and redirect
// once `ready` is true.
export function useConsentAfterSignIn() {
  const { isAuthenticated } = useConvexAuth();
  const record = useMutation(api.privacy.recordConsent);
  const [pending, setPending] = useState<Method | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !pending || done) return;
    record({ policyVersion: PRIVACY_POLICY_VERSION, method: pending })
      .catch((e) => console.warn('[consent] not recorded', e))
      .finally(() => setDone(true));
  }, [isAuthenticated, pending, done, record]);

  return { markPending: setPending, ready: isAuthenticated && (!pending || done) };
}
