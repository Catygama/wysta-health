import { Text, View } from 'react-native';
import type { Href } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HeaderBack } from '@/components/ui/HeaderBack';
import { fonts } from '@/lib/fonts';

// Title of a tab's main list ("‹ Conversas"), the same for patient and
// professional. The arrow always goes to the role's main screen (`home`).
export function TabTitle({ title, home }: { title: string; home: Href }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.row, insets.top > 0 && { paddingTop: insets.top }]}>
      <HeaderBack home={home} />
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
    backgroundColor: theme.colors.background,
  },
  title: { fontFamily: fonts.displayBold, fontSize: 20, color: theme.colors.textPrimary },
}));
