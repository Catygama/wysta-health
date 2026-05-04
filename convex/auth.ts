import { convexAuth } from '@convex-dev/auth/server';
import { Password } from '@convex-dev/auth/providers/Password';
import { Anonymous } from '@convex-dev/auth/providers/Anonymous';

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  // Two anonymous providers so the server can distinguish guest patients
  // from guest professionals without a follow-up client mutation. The
  // afterUserCreatedOrUpdated callback creates the matching userProfile
  // atomically with the sign-in, avoiding the auth-token race that breaks
  // a client-side ensureProfile() right after signIn().
  //
  // Disable in production by removing the Anonymous providers, or hide
  // the UI entry points via EXPO_PUBLIC_GUEST_AUTH on the client.
  providers: [
    Password,
    Anonymous(),
    Anonymous({ id: 'anonymous-professional' }),
  ],
  callbacks: {
    afterUserCreatedOrUpdated: async (
      ctx,
      { userId, existingUserId, type, provider }
    ) => {
      // Only act on first sign-in (account creation), not subsequent
      // sign-ins for the same account.
      if (existingUserId) return;
      if (type !== 'credentials') return;

      // The callback ctx is generic over the data model; cast db so the
      // schema-typed indexes/inserts type-check here.
      const db = ctx.db as unknown as {
        query: (table: string) => any;
        insert: (table: string, doc: any) => Promise<unknown>;
      };
      const existing = await db
        .query('userProfiles')
        .withIndex('by_user', (q: any) => q.eq('userId', userId))
        .unique();
      if (existing) return;

      if (provider.id === 'anonymous-professional') {
        await db.insert('userProfiles', {
          userId,
          role: 'professional',
          isGuest: true,
          // TODO: remove auto-verify once admin review UI is in place.
          professionalVerificationStatus: 'verified',
        });
      } else if (provider.id === 'anonymous') {
        await db.insert('userProfiles', {
          userId,
          role: 'patient',
          isGuest: true,
        });
      }
      // For Password sign-ups we deliberately leave profile creation to
      // the client (onboarding screen / professional verification flow)
      // so role can be chosen explicitly.
    },
  },
});
