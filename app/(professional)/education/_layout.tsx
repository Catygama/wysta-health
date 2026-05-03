import { Stack } from 'expo-router';
import { colors } from '@/constants/theme';

export default function EducationLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTintColor: colors.primary as any,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Saúde' }} />
      <Stack.Screen name="[id]" options={{ title: 'Artigo', headerBackTitle: 'Voltar' }} />
    </Stack>
  );
}
