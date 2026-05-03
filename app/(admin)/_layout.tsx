import { Redirect, Stack } from 'expo-router';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { colors } from '@/constants/theme';

export default function AdminLayout() {
  const { user, isLoading, role } = useCurrentUser();
  if (isLoading) return null;
  if (!user || role !== 'admin') return <Redirect href="/" />;

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTintColor: colors.primary as any,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Administração' }} />
    </Stack>
  );
}
