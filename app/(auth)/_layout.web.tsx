import { Slot } from 'expo-router';
import { View, Text, useWindowDimensions } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { fonts } from '@/lib/fonts';

const MOBILE_BREAKPOINT = 640;

export default function AuthLayoutWeb() {
  const { width } = useWindowDimensions();
  const isMobile = width < MOBILE_BREAKPOINT;

  return (
    <View style={[styles.root, isMobile ? styles.rootMobile : styles.rootDesktop]}>
      <View style={[styles.brandBar, isMobile ? styles.brandBarMobile : styles.brandBarDesktop]}>
        <View style={styles.brand}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>W</Text>
          </View>
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
  root: { flex: 1, minHeight: '100vh' as any },
  rootMobile: { backgroundColor: theme.colors.background },
  rootDesktop: { backgroundColor: theme.colors.background },
  brandBar: { paddingHorizontal: theme.spacing.lg },
  brandBarMobile: { paddingTop: theme.spacing.lg, alignItems: 'flex-start' },
  brandBarDesktop: { paddingTop: theme.spacing.xl, alignItems: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
  logo: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: theme.colors.onInk, fontFamily: fonts.displayExtraBold, fontSize: 15 },
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
