import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useUnistyles } from 'react-native-unistyles';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { usePushRegistration } from '@/hooks/usePushRegistration';
import { TabBarProvider, useTabBar } from '@/contexts/TabBarContext';

export default function PatientLayout() {
  const { user, isLoading, role } = useCurrentUser();
  usePushRegistration(role === 'patient');
  if (isLoading) return null;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (!role) return <Redirect href="/(auth)/onboarding" />;
  if (role === 'professional') return <Redirect href="/(professional)/queue" />;
  if (role === 'admin') return <Redirect href="/(admin)/" />;

  return (
    <TabBarProvider>
      <PatientTabs />
    </TabBarProvider>
  );
}

function PatientTabs() {
  const { isTabBarHidden } = useTabBar();
  const { theme } = useUnistyles();
  return (
    // Selected tab in the brand colour (iOS defaults to system blue).
    <NativeTabs hidden={isTabBarHidden} tintColor={theme.colors.inkText}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
        <NativeTabs.Trigger.Label>Início</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="conversations">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'bubble.left.and.bubble.right', selected: 'bubble.left.and.bubble.right.fill' }}
          md="forum"
        />
        <NativeTabs.Trigger.Label>Conversas</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="education">
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
