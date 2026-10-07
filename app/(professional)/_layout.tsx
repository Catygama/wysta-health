import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { isVerifiedProfessional } from '@/convex/lib/professional';
import { ProfessionalVerificationStatus } from '@/screens/ProfessionalVerificationStatus';
import { TabBarProvider, useTabBar } from '@/contexts/TabBarContext';

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

  return (
    <TabBarProvider>
      <ProfessionalTabs />
    </TabBarProvider>
  );
}

function ProfessionalTabs() {
  const { isTabBarHidden } = useTabBar();
  return (
    <NativeTabs hidden={isTabBarHidden}>
      <NativeTabs.Trigger name="queue">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'list.bullet.clipboard', selected: 'list.bullet.clipboard.fill' }}
          md="assignment"
        />
        <NativeTabs.Trigger.Label>Fila</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="ongoing">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'bubble.left.and.bubble.right', selected: 'bubble.left.and.bubble.right.fill' }}
          md="forum"
        />
        <NativeTabs.Trigger.Label>Conversas</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="library">
        <NativeTabs.Trigger.Icon sf={{ default: 'book', selected: 'book.fill' }} md="book" />
        <NativeTabs.Trigger.Label>Explorar</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Icon sf={{ default: 'person', selected: 'person.fill' }} md="person" />
        <NativeTabs.Trigger.Label>Perfil</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
