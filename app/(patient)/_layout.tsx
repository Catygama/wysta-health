import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { colors } from '@/constants/theme';

export default function PatientLayout() {
  const { user, isLoading, role } = useCurrentUser();
  if (isLoading) return null;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (role !== 'patient') return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Início' }} />
      <Tabs.Screen name="conversations" options={{ title: 'Conversas' }} />
      <Tabs.Screen name="education" options={{ title: 'Saúde' }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}
