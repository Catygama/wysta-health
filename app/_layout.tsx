import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { ConvexReactClient } from 'convex/react';
import { Stack } from 'expo-router';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { authStorage } from '@/lib/storage';
import { ThemeProvider, useTheme } from '@/lib/theme';
import { E2EBridge } from '@/components/E2EBridge';

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!);

export default function RootLayout() {
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
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background.primary as any },
      }}
    />
  );
}
