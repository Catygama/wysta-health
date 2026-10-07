import { Redirect, Stack } from 'expo-router';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useStackHeaderOptions } from '@/hooks/useHeaderOptions';

export default function AdminLayout() {
  const { user, isLoading, role } = useCurrentUser();
  const headerOptions = useStackHeaderOptions();
  if (isLoading) return null;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (!role) return <Redirect href="/(auth)/onboarding" />;
  if (role === 'patient') return <Redirect href="/(patient)/" />;
  if (role === 'professional') return <Redirect href="/(professional)/queue" />;

  return (
    <Stack screenOptions={headerOptions}>
      <Stack.Screen name="index" options={{ title: 'Administração' }} />
      <Stack.Screen name="verifications" options={{ title: 'Verificações' }} />
      <Stack.Screen name="ai" options={{ title: 'Gestão da IA' }} />
    </Stack>
  );
}
