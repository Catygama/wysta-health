import { Stack } from 'expo-router';
import { useStackHeaderOptions } from '@/hooks/useHeaderOptions';

export default function ProfessionalProfileLayout() {
  return (
    <Stack screenOptions={useStackHeaderOptions()}>
      <Stack.Screen name="index" options={{ title: 'Perfil' }} />
      <Stack.Screen name="history/index" options={{ title: 'Histórico', headerBackTitle: 'Perfil' }} />
      <Stack.Screen name="history/[id]" options={{ title: 'Conversa', headerBackTitle: 'Histórico' }} />
    </Stack>
  );
}
