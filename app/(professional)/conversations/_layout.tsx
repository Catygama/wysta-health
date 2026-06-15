import { Stack } from 'expo-router';
import { useStackHeaderOptions } from '@/hooks/useHeaderOptions';

export default function ConversationsLayout() {
  return (
    <Stack screenOptions={useStackHeaderOptions()}>
      <Stack.Screen name="[id]" options={{ title: 'Conversa', headerBackTitle: 'Voltar' }} />
    </Stack>
  );
}
