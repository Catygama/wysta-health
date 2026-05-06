import { Stack } from 'expo-router';
import { useTheme } from '@/lib/theme';

export default function ConversationsLayout() {
  const { colors } = useTheme();
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
      <Stack.Screen name="index" options={{ title: 'Conversas' }} />
      <Stack.Screen name="[id]" options={{ title: 'Conversa', headerBackTitle: 'Voltar' }} />
    </Stack>
  );
}
