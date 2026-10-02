import { Stack } from 'expo-router';
import { useStackHeaderOptions } from '@/hooks/useHeaderOptions';

export default function EducationLayout() {
  return (
    <Stack screenOptions={useStackHeaderOptions()}>
      <Stack.Screen name="index" options={{ title: 'Saúde' }} />
      <Stack.Screen name="[id]" options={{ title: 'Artigo', headerBackTitle: 'Voltar' }} />
    </Stack>
  );
}
