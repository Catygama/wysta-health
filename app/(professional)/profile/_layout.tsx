import { Stack } from 'expo-router';
import { useStackHeaderOptions } from '@/hooks/useHeaderOptions';

export default function ProfessionalProfileLayout() {
  return (
    <Stack screenOptions={useStackHeaderOptions()}>
      {/* The profile screen draws its own title. */}
      <Stack.Screen name="index" options={{ headerShown: false, title: 'Perfil' }} />
      <Stack.Screen name="history/index" options={{ title: 'Histórico', headerBackTitle: 'Perfil' }} />
      <Stack.Screen name="history/[id]" options={{ title: 'Conversa', headerBackTitle: 'Histórico' }} />
    </Stack>
  );
}
