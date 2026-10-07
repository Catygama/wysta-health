import { Redirect, Stack } from 'expo-router';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { isVerifiedProfessional } from '@/convex/lib/professional';
import { ProfessionalVerificationStatus } from '@/screens/ProfessionalVerificationStatus';
import { TabBarProvider } from '@/contexts/TabBarContext';

export default function ProfessionalLayout() {
  const { user, isLoading, role } = useCurrentUser();
  if (isLoading) return null;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (!role) return <Redirect href="/(auth)/onboarding" />;
  if (role === 'patient') return <Redirect href="/(patient)/" />;
  if (role === 'admin') return <Redirect href="/(admin)/" />;
  // Sign-up awaiting (or refused) admin verification: no queue, cases or chats.
  if (!isVerifiedProfessional(user.profile)) {
    const status = user.profile?.professionalVerificationStatus === 'rejected' ? 'rejected' : 'pending';
    return (
      <ProfessionalVerificationStatus
        status={status}
        rejectionReason={user.profile?.professionalVerificationRejectionReason}
      />
    );
  }

  // The tabs, with the case screen pushed over them: native tabs can't open a
  // route that isn't a tab, so `cases` lives in this stack instead.
  return (
    <TabBarProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="cases" />
      </Stack>
    </TabBarProvider>
  );
}
