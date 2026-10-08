import { Slot } from 'expo-router';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

const MOBILE_BREAKPOINT = 640;

// Web sign-in / sign-up: the screen in a centred card on wide screens. The
// whole page scrolls (scrollbar at the window edge), not the card.
export default function AuthLayoutWeb() {
  const { width } = useWindowDimensions();
  const isMobile = width < MOBILE_BREAKPOINT;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.page, !isMobile && styles.pageDesktop]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.panel, isMobile ? styles.panelMobile : styles.panelDesktop]}>
        <Slot />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  // dvh: the visible height. On iPhone Safari 100vh is taller than what's
  // shown, so the whole page could slide up under the status bar.
  root: { flex: 1, height: '100dvh' as any, backgroundColor: theme.colors.background },
  page: { flexGrow: 1, alignItems: 'center' },
  pageDesktop: { paddingVertical: theme.spacing.xl },
  panel: { width: '100%' },
  panelMobile: { backgroundColor: theme.colors.background, borderRadius: 0 },
  panelDesktop: {
    maxWidth: 480,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderCurve: 'continuous',
  },
}));
