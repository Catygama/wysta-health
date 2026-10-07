import { Stack } from 'expo-router';
import { useStackHeaderOptions } from '@/hooks/useHeaderOptions';

export default function EducationLayout() {
  return (
    <Stack screenOptions={useStackHeaderOptions()}>
      {/* No title: the tab is already called Explorar; the search bar leads. */}
      <Stack.Screen name="index" options={{ headerShown: false, title: 'Explorar' }} />
      <Stack.Screen name="[id]" options={{ title: 'Artigo', headerBackTitle: 'Voltar' }} />
    </Stack>
  );
}
