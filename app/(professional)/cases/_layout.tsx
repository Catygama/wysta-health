import { Stack } from 'expo-router';
import { headerItems, useStackHeaderOptions } from '@/hooks/useHeaderOptions';
import { HeaderBack } from '@/components/ui/HeaderBack';

export default function ConversationsLayout() {
  return (
    <Stack screenOptions={useStackHeaderOptions()}>
      <Stack.Screen
        name="[id]"
        options={{
          title: 'Conversa',
          // Always our own back button: opened from the Fila or Conversas (other
          // stacks) the stack shows none. Goes back, else to the Fila.
          ...headerItems({ left: () => <HeaderBack fallback="/(professional)/queue" /> }),
        }}
      />
    </Stack>
  );
}
