import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { ConvexReactClient } from 'convex/react';
import { Stack } from 'expo-router';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useUnistyles } from 'react-native-unistyles';
import { authStorage } from '@/lib/storage';
import { ThemeProvider } from '@/lib/theme';
import { useBrandFonts } from '@/lib/fonts';
import { E2EBridge } from '@/components/E2EBridge';
import '@/lib/webFocusStyles';

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!);

export default function RootLayout() {
  const fontsLoaded = useBrandFonts();
  if (!fontsLoaded) {
    return null;
  }
  return (
    <ThemeProvider>
      <KeyboardProvider>
        <ConvexAuthProvider client={convex} storage={authStorage}>
          <E2EBridge />
          <RootStack />
        </ConvexAuthProvider>
      </KeyboardProvider>
    </ThemeProvider>
  );
}

function RootStack() {
  // Threading the themed background into the navigator's `contentStyle` is
  // what fills the gap between the WebShell content panel and Stack screens
  // that don't paint their own root view (e.g. the Stack containers inside
  // route groups like /conversations).
  const { theme } = useUnistyles();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background as any },
      }}
    />
  );
}
