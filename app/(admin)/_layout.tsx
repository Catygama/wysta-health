import { Redirect, Stack } from 'expo-router';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useTheme } from '@/lib/theme';

export default function AdminLayout() {
  const { user, isLoading, role } = useCurrentUser();
  const { colors } = useTheme();
  if (isLoading) return null;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (!role) return <Redirect href="/(auth)/onboarding" />;
  if (role === 'patient') return <Redirect href="/(patient)/" />;
  if (role === 'professional') return <Redirect href="/(professional)/queue" />;

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTintColor: colors.primary as any,
        headerTitleStyle: { fontWeight: '700', color: colors.text.primary as any },
        headerStyle: { backgroundColor: colors.background.primary as any },
        contentStyle: { backgroundColor: colors.background.primary as any },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Administração' }} />
      <Stack.Screen name="ai" options={{ title: 'AI Infra' }} />
    </Stack>
  );
}
