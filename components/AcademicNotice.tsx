import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '@/components/ui/Icon';
import { strings } from '@/constants/strings';

// "This is an academic prototype, not a real clinical service" notice.
export function AcademicNotice() {
  const { theme } = useUnistyles();
  return (
    <View
      testID="academic-notice"
      style={styles.card}
      accessible
      accessibilityLabel={`${strings.academic.title}. ${strings.academic.message}`}
    >
      <Icon
        name={{ sf: 'graduationcap', ion: 'school-outline' }}
        size={18}
        color={theme.colors.inkText}
      />
      <View style={styles.body}>
        <Text style={styles.title}>{strings.academic.title}</Text>
        <Text style={styles.message}>{strings.academic.message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surfaceSunken,
    borderWidth: 1,
    borderColor: theme.colors.divider,
  },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 13, fontWeight: '600', color: theme.colors.inkText },
  message: { fontSize: 13, lineHeight: 19, color: theme.colors.textSecondary },
}));
