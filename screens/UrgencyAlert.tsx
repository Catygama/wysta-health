import { useEffect } from 'react';
import { View, Text, Pressable, Linking, AccessibilityInfo } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { strings } from '@/constants/strings';
import { fonts } from '@/lib/fonts';

type Props = {
  onDismiss: () => void;
};

const SNS24_TEL = 'tel:808242424';
const EMERGENCY_TEL = 'tel:112';

export function UrgencyAlert({ onDismiss }: Props) {
  // Screen readers don't notice content that appears mid-flow; announce it.
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(
      `${strings.urgency.title}. ${strings.urgency.message}`,
    );
  }, []);

  return (
    <View testID="urgency-alert" accessibilityRole="alert" style={styles.card}>
      <Text style={styles.title} accessibilityRole="header">
        <Text aria-hidden>⚠️ </Text>
        {strings.urgency.title}
      </Text>
      <Text style={styles.message}>{strings.urgency.message}</Text>
      <View style={styles.contacts}>
        <Text style={styles.contactsLabel}>Contactos de emergência:</Text>
        <Pressable
          testID="urgency-call-sns24"
          accessibilityRole="link"
          accessibilityLabel={strings.urgency.snsCta}
          onPress={() => Linking.openURL(SNS24_TEL)}
          style={({ pressed }) => [styles.contactRow, pressed && styles.pressed]}
        >
          <Text style={styles.sns}>SNS 24: 808 24 24 24</Text>
        </Pressable>
        <Pressable
          testID="urgency-call-112"
          accessibilityRole="link"
          accessibilityLabel={strings.urgency.emergencyCta}
          onPress={() => Linking.openURL(EMERGENCY_TEL)}
          style={({ pressed }) => [styles.contactRow, pressed && styles.pressed]}
        >
          <Text style={styles.emergency}>Emergência: 112</Text>
        </Pressable>
      </View>
      <Pressable
        testID="urgency-dismiss"
        accessibilityRole="button"
        onPress={onDismiss}
        style={styles.dismissButton}
      >
        <Text style={styles.dismiss}>{strings.urgency.dismiss}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    backgroundColor: theme.colors.dangerLight,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  title: { fontFamily: fonts.displayBold, fontSize: 20, color: theme.colors.danger },
  message: { fontSize: 16, color: theme.colors.textPrimary, lineHeight: 24 },
  contacts: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  contactsLabel: { fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },
  contactRow: { minHeight: 44, justifyContent: 'center' },
  pressed: { opacity: 0.7 },
  sns: {
    fontSize: 16,
    // accent, not ink: ink is a fill color and drops to ~1.4:1 as text in dark mode.
    color: theme.colors.accent,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  emergency: {
    fontSize: 16,
    color: theme.colors.danger,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  dismissButton: { minHeight: 44, justifyContent: 'center' },
  dismiss: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
}));
