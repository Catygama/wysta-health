import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { ConvexReactClient } from 'convex/react';
import { Stack } from 'expo-router';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { authStorage } from '@/lib/storage';

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!);

export default function RootLayout() {
  return (
    <KeyboardProvider>
      <ConvexAuthProvider client={convex} storage={authStorage}>
        <Stack screenOptions={{ headerShown: false }} />
      </ConvexAuthProvider>
    </KeyboardProvider>
  );
}
