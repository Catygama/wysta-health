import { Stack } from 'expo-router';
import { useStackHeaderOptions } from '@/hooks/useHeaderOptions';
import { HeaderBack } from '@/components/ui/HeaderBack';

export default function ConversationsLayout() {
  return (
    <Stack screenOptions={useStackHeaderOptions()}>
      <Stack.Screen
        name="[id]"
        options={({ navigation }) => ({
          title: 'Conversa',
          headerBackTitle: 'Voltar',
          // Opened from the queue (another stack), so there's no native back button.
          headerLeft: navigation.canGoBack()
            ? undefined
            : () => <HeaderBack fallback="/(professional)/ongoing" />,
        })}
      />
    </Stack>
  );
}
