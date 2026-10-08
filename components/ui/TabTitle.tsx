import { Text, View } from 'react-native';
import type { Href } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBack } from '@/components/ui/HeaderBack';
import { fonts } from '@/lib/fonts';

// Title of a tab's main list ("‹ Conversas"), the same for patient and
// professional. The arrow always goes to the role's main screen (`home`).
// SafeAreaView measures where it actually sits on screen, so the title clears
// the status bar on phones (inside native tabs the inset hook can report 0);
// on web the inset is 0. Plain inline style on it: Unistyles styles are partly
// dropped on third-party components.
export function TabTitle({ title, home }: { title: string; home: Href }) {
  const { theme } = useUnistyles();
  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: theme.colors.background }}>
      <View style={styles.row}>
        <HeaderBack home={home} />
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
      </View>
    </SafeAreaView>
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
  },
  title: { fontFamily: fonts.displayBold, fontSize: 20, color: theme.colors.textPrimary },
}));
