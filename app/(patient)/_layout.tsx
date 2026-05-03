import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { TabBarProvider, useTabBar } from '@/contexts/TabBarContext';

export default function PatientLayout() {
  const { user, isLoading, role } = useCurrentUser();
  if (isLoading) return null;
  if (!user || role !== 'patient') return <Redirect href="/" />;

  return (
    <TabBarProvider>
      <PatientTabs />
    </TabBarProvider>
  );
}

function PatientTabs() {
  const { isTabBarHidden } = useTabBar();
  return (
    <NativeTabs hidden={isTabBarHidden}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
        <NativeTabs.Trigger.Label>Início</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="conversations">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'bubble.left.and.bubble.right', selected: 'bubble.left.and.bubble.right.fill' }}
          md="chat_bubble"
        />
        <NativeTabs.Trigger.Label>Conversas</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="education">
        <NativeTabs.Trigger.Icon sf={{ default: 'book', selected: 'book.fill' }} md="book" />
        <NativeTabs.Trigger.Label>Saúde</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Icon sf={{ default: 'person', selected: 'person.fill' }} md="person" />
        <NativeTabs.Trigger.Label>Perfil</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="triage" hidden />
    </NativeTabs>
  );
}
