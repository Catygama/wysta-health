import { Stack } from 'expo-router';
import { useStackHeaderOptions } from '@/hooks/useHeaderOptions';
import { HeaderBack } from '@/components/ui/HeaderBack';

export default function EducationLayout() {
  return (
    <Stack screenOptions={useStackHeaderOptions()}>
      {/* No title: the tab is already called Explorar; the search bar leads. */}
      <Stack.Screen name="index" options={{ headerShown: false, title: 'Explorar' }} />
      <Stack.Screen
        name="[id]"
        // Own back button: opened by link or reload there is no screen beneath.
        options={{ title: 'Artigo', headerLeft: () => <HeaderBack fallback="/(professional)/library" /> }}
      />
    </Stack>
  );
}
