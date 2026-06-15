import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUnistyles } from 'react-native-unistyles';

export default function Index() {
  const { user, isLoading, role } = useCurrentUser();
  const { theme } = useUnistyles();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={theme.colors.ink} />
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
