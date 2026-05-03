import { Stack } from 'expo-router';
import { colors } from '@/constants/theme';

export default function ConversationsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTintColor: colors.primary as any,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="[id]" options={{ title: 'Conversa', headerBackTitle: 'Voltar' }} />
    </Stack>
  );
}
