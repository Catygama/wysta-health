import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { ConvexReactClient } from 'convex/react';
import { Stack } from 'expo-router';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { authStorage } from '@/lib/storage';
import { ThemeProvider } from '@/lib/theme';
import { E2EBridge } from '@/components/E2EBridge';

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!);

export default function RootLayout() {
  return (
    <ThemeProvider>
      <KeyboardProvider>
        <ConvexAuthProvider client={convex} storage={authStorage}>
          <E2EBridge />
          <Stack screenOptions={{ headerShown: false }} />
        </ConvexAuthProvider>
      </KeyboardProvider>
    </ThemeProvider>
  );
}
