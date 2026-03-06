import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { colors } from '@/constants/theme';

export default function Index() {
  const { user, isLoading, role } = useCurrentUser();

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
