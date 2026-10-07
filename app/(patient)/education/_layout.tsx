import { Stack } from 'expo-router';
import { useStackHeaderOptions } from '@/hooks/useHeaderOptions';

export default function EducationLayout() {
  return (
    <Stack screenOptions={useStackHeaderOptions()}>
      {/* No title: the tab is already called Explorar; the search bar leads. */}
      <Stack.Screen name="index" options={{ headerShown: false, title: 'Explorar' }} />
      {/* The article draws its own "‹ Explorar", aligned with its text column. */}
      <Stack.Screen name="[id]" options={{ headerShown: false, title: 'Artigo' }} />
    </Stack>
  );
}
