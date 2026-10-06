import { Stack } from 'expo-router';
import { useStackHeaderOptions } from '@/hooks/useHeaderOptions';
import { HeaderBack } from '@/components/ui/HeaderBack';

// Keeps the list beneath a conversation opened straight from triage (via
// router.replace), so the thread always has somewhere to go back to.
export const unstable_settings = { initialRouteName: 'index' };

export default function ConversationsLayout() {
  return (
    <Stack screenOptions={useStackHeaderOptions()}>
      <Stack.Screen name="index" options={{ title: 'Conversas' }} />
      <Stack.Screen
        name="[id]"
        options={({ navigation }) => ({
          title: 'Conversa',
          headerBackTitle: 'Voltar',
          headerLeft: navigation.canGoBack() ? undefined : () => <HeaderBack fallback="/" />,
        })}
      />
    </Stack>
  );
}
