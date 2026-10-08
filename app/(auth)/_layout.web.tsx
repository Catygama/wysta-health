import { Slot } from 'expo-router';
import { View, Text, useWindowDimensions } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { fonts } from '@/lib/fonts';
import { BrandMark } from '@/components/ui/BrandMark';

const MOBILE_BREAKPOINT = 640;

export default function AuthLayoutWeb() {
  const { width } = useWindowDimensions();
  const isMobile = width < MOBILE_BREAKPOINT;

  return (
    <View style={[styles.root, isMobile ? styles.rootMobile : styles.rootDesktop]}>
      <View style={[styles.brandBar, isMobile ? styles.brandBarMobile : styles.brandBarDesktop]}>
        <View style={styles.brand}>
          <BrandMark size={30} />
          <Text style={styles.wordmark}>Wysta</Text>
        </View>
      </View>
      <View style={[styles.center, !isMobile && styles.centerDesktop]}>
        <View style={[styles.panel, isMobile ? styles.panelMobile : styles.panelDesktop]}>
          <Slot />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  // The visible height: --wysta-vh (lib/webViewport) also shrinks while the
  // iOS keyboard is open; 100dvh is the fallback. Plain 100vh is taller than
  // what iPhone Safari shows, so the page could slide under the status bar.
  root: { flex: 1, minHeight: 'var(--wysta-vh, 100dvh)' as any },
  rootMobile: { backgroundColor: theme.colors.background },
  rootDesktop: { backgroundColor: theme.colors.background },
  brandBar: { paddingHorizontal: theme.spacing.lg },
  brandBarMobile: { paddingTop: theme.spacing.lg, alignItems: 'flex-start' },
  brandBarDesktop: { paddingTop: theme.spacing.xl, alignItems: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
  wordmark: { fontFamily: fonts.displayBold, fontSize: 18, color: theme.colors.inkText, letterSpacing: -0.3 },
  center: { flex: 1, alignItems: 'center' },
  centerDesktop: { paddingVertical: theme.spacing.lg },
  panel: { flex: 1, width: '100%' },
  panelMobile: { backgroundColor: theme.colors.background, borderRadius: 0 },
  panelDesktop: {
    maxWidth: 480,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderCurve: 'continuous',
  },
}));
