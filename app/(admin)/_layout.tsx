import { Redirect } from 'expo-router';
import { Stack } from 'expo-router';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export default function AdminLayout() {
  const { user, isLoading, role } = useCurrentUser();
  if (isLoading) return null;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (role !== 'admin') return <Redirect href="/(auth)/login" />;

  return <Stack screenOptions={{ headerShown: true }} />;
}
