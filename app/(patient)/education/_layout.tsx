import { Stack } from 'expo-router';
import { useStackHeaderOptions } from '@/hooks/useHeaderOptions';

export default function EducationLayout() {
  return (
    <Stack screenOptions={useStackHeaderOptions()}>
      {/* The screen draws its own title, close to the search bar. */}
      <Stack.Screen name="index" options={{ headerShown: false, title: 'Explorar' }} />
      <Stack.Screen name="[id]" options={{ title: 'Artigo', headerBackTitle: 'Voltar' }} />
    </Stack>
  );
}
