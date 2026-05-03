import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { TabBarProvider, useTabBar } from '@/contexts/TabBarContext';

export default function ProfessionalLayout() {
  const { user, isLoading, role } = useCurrentUser();
  if (isLoading) return null;
  if (!user || role !== 'professional') return <Redirect href="/" />;

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

      <NativeTabs.Trigger name="education">
        <NativeTabs.Trigger.Icon sf={{ default: 'book', selected: 'book.fill' }} md="book" />
        <NativeTabs.Trigger.Label>Saúde</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
