import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useTheme } from '@/lib/theme';

export default function Index() {
  const { user, isLoading, role } = useCurrentUser();
  const { colors } = useTheme();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!user) return <Redirect href="/(auth)/login" />;

  // Authenticated but no profile yet → onboarding
  if (!role) return <Redirect href="/(auth)/onboarding" />;

  if (role === 'admin') return <Redirect href="/(admin)/" />;
  if (role === 'professional') return <Redirect href="/(professional)/queue" />;
  return <Redirect href="/(patient)/" />;
}
