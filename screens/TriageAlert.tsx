import { useEffect } from 'react';
import { View, Text, Pressable, Linking, AccessibilityInfo } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon, type IconName } from '@/components/ui/Icon';
import type { ResolvedAlert } from '@/constants/triageAlerts';
import type { AlertLevel } from '@/convex/lib/alerts';
import { fonts } from '@/lib/fonts';

// Each level is told apart by its icon and label text, not by colour alone.
const ICONS: Record<Exclude<AlertLevel, 'priority'>, IconName> = {
  emergency: { sf: 'exclamationmark.triangle.fill', ion: 'warning' },
  urgent: { sf: 'phone.fill', ion: 'call' },
  'time-sensitive': { sf: 'clock.fill', ion: 'time' },
};

type Props = { alert: ResolvedAlert; onDismiss: () => void };

export function TriageAlert({ alert, onDismiss }: Props) {
  const { theme } = useUnistyles();
  const level = alert.level as Exclude<AlertLevel, 'priority'>;
  styles.useVariants({ level });

  // Content that appears mid-flow isn't noticed by screen readers; announce it.
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`${alert.label}. ${alert.message}`);
  }, [alert.label, alert.message]);

  return (
    <View
      testID="triage-alert"
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      style={styles.card}
    >
      <View style={styles.head}>
        <View style={styles.tag}>
          <Icon name={ICONS[level]} size={16} color={theme.colors.onInk} />
          <Text style={styles.tagText}>{alert.label}</Text>
        </View>
      </View>
      <Text testID="triage-alert-message" style={styles.message}>
        {alert.message}
      </Text>

      {alert.call && (
        <Pressable
          testID="triage-alert-call"
          accessibilityRole="button"
          accessibilityLabel={alert.call.a11yLabel}
          onPress={() => Linking.openURL(alert.call!.tel)}
          style={({ pressed }) => [styles.call, pressed && styles.pressed]}
        >
          <Icon name={{ sf: 'phone.fill', ion: 'call' }} size={18} color={theme.colors.onInk} />
          <Text style={styles.callText}>{alert.call.label}</Text>
        </Pressable>
      )}

      {alert.fallback112 && (
        <Pressable
          testID="triage-alert-112"
          accessibilityRole="button"
          accessibilityLabel="Em caso de emergência, ligar para o 112"
          onPress={() => Linking.openURL('tel:112')}
          hitSlop={6}
          style={styles.fallback}
        >
          <Text style={styles.fallbackText}>
            Em caso de emergência, liga <Text style={styles.fallbackStrong}>112</Text>
          </Text>
        </Pressable>
      )}

      <Pressable
        testID="triage-alert-dismiss"
        accessibilityRole="button"
        onPress={onDismiss}
        style={styles.dismiss}
      >
        <Text style={styles.dismissText}>
          {level === 'time-sensitive' ? 'Continuar' : 'Continuar mesmo assim'}
        </Text>
      </Pressable>
    </View>
  );
}

// Wine (#50000D) text on light surfaces throughout: 14:1 or more. The level
// stripe and tag add colour on top of the icon + label, never instead of them.
const styles = StyleSheet.create((theme) => ({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    borderLeftWidth: 6,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    variants: {
      level: {
        emergency: { borderColor: theme.colors.danger },
        urgent: { borderColor: theme.colors.ink },
        'time-sensitive': { borderColor: theme.colors.accent },
      },
    },
  },
  head: { flexDirection: 'row' },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: theme.radius.pill,
    variants: {
      level: {
        emergency: { backgroundColor: theme.colors.danger },
        urgent: { backgroundColor: theme.colors.ink },
        'time-sensitive': { backgroundColor: theme.colors.accent },
      },
    },
  },
  tagText: { color: theme.colors.onInk, fontWeight: '700', fontSize: 14, letterSpacing: 0.3 },
  message: {
    fontSize: 17,
    lineHeight: 25,
    color: theme.colors.textPrimary,
    variants: {
      level: {
        // Short calls to action in the display face; the longer advice in body text.
        emergency: { fontFamily: fonts.displayBold },
        urgent: { fontFamily: fonts.displayBold },
        'time-sensitive': { fontSize: 16, lineHeight: 24 },
      },
    },
  },
  call: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    minHeight: 52,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.ink,
    paddingHorizontal: theme.spacing.lg,
  },
  pressed: { opacity: 0.85 },
  callText: { color: theme.colors.onInk, fontSize: 16, fontWeight: '700' },
  fallback: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  fallbackText: { fontSize: 15, color: theme.colors.textPrimary },
  fallbackStrong: { fontWeight: '700', textDecorationLine: 'underline' },
  dismiss: { minHeight: 44, justifyContent: 'center' },
  dismissText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
}));
