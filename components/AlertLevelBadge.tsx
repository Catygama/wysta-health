import { View, Text } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon, type IconName } from '@/components/ui/Icon';
import { ALERT_LABELS } from '@/constants/triageAlerts';
import type { AlertLevel } from '@/convex/lib/alerts';

// Triage alert level for professionals: icon + text label, so the level never
// depends on colour alone.
const ICONS: Record<AlertLevel, IconName> = {
  emergency: { sf: 'exclamationmark.triangle.fill', ion: 'warning' },
  urgent: { sf: 'phone.fill', ion: 'call' },
  'time-sensitive': { sf: 'clock.fill', ion: 'time' },
  priority: { sf: 'arrow.up', ion: 'arrow-up' },
};

export function AlertLevelBadge({ level, testID }: { level: AlertLevel; testID?: string }) {
  const { theme } = useUnistyles();
  styles.useVariants({ level });
  const onFill = level === 'priority' ? theme.colors.inkText : theme.colors.onInk;
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Nível de triagem: ${ALERT_LABELS[level]}`}
      style={styles.badge}
    >
      <Icon name={ICONS[level]} size={12} color={onFill} />
      <Text style={[styles.text, { color: onFill }]}>{ALERT_LABELS[level]}</Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: theme.radius.pill,
    alignSelf: 'flex-start',
    variants: {
      level: {
        emergency: { backgroundColor: theme.colors.danger },
        urgent: { backgroundColor: theme.colors.ink },
        'time-sensitive': { backgroundColor: theme.colors.accent },
        // Outlined: lowest level, still a 3:1+ boundary.
        priority: { borderWidth: 1.5, borderColor: theme.colors.textSecondary },
      },
    },
  },
  text: { fontSize: 12, fontWeight: '700' },
}));
