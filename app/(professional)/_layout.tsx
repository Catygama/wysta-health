import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { colors } from '@/constants/theme';

export default function ProfessionalLayout() {
  const { user, isLoading, role } = useCurrentUser();
  if (isLoading) return null;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (role !== 'professional') return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        headerShown: false,
      }}
    >
      <Tabs.Screen name="queue" options={{ title: 'Fila' }} />
      <Tabs.Screen name="education" options={{ title: 'Saúde' }} />
    </Tabs>
  );
}
