import { useEffect } from 'react';
import { View, Text, Pressable, Linking, AccessibilityInfo, Modal } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { strings } from '@/constants/strings';
import { fonts } from '@/lib/fonts';
import { Icon, type IconName } from '@/components/ui/Icon';

type Call = '112' | 'sns24';

type Props = {
  onDismiss: () => void;
  /** Defaults: the generic urgency copy, 112 then SNS 24 (wellbeing pain check). */
  title?: string;
  message?: string;
  /** Call buttons in order; the first one is the filled (primary) button. */
  calls?: Call[];
  /** Spoken name of the SNS 24 line (e.g. the SNS Grávida line, same number). */
  snsAccessibilityLabel?: string;
  dismissLabel?: string;
  /** testID prefix; the triage uses 'triage-alert'. */
  testIDPrefix?: string;
};

const SNS24_TEL = 'tel:808242424';
const EMERGENCY_TEL = 'tel:112';
const PHONE_ICON: IconName = { sf: 'phone.fill', ion: 'call' };

// Shown over a dimmed screen when an answer needs attention (triage alert
// levels, wellbeing pain check): call 112 or SNS 24, or carry on.
export function UrgencyAlert({
  onDismiss,
  title = strings.urgency.title,
  message = strings.urgency.message,
  calls = ['112', 'sns24'],
  snsAccessibilityLabel = strings.urgency.snsCta,
  dismissLabel = strings.urgency.dismiss,
  testIDPrefix,
}: Props) {
  const { theme } = useUnistyles();
  const id = (triage: string, legacy: string) => (testIDPrefix ? `${testIDPrefix}${triage}` : legacy);

  // Screen readers don't notice content that appears mid-flow; announce it.
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`${title}. ${message}`);
  }, [title, message]);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View testID={id('', 'urgency-alert')} accessibilityRole="alert" style={styles.card}>
          <View style={styles.iconChip}>
            <Icon
              name={{ sf: 'exclamationmark.triangle.fill', ion: 'warning-outline' }}
              size={22}
              color={theme.colors.inkText}
            />
          </View>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <Text testID={id('-message', 'urgency-message')} style={styles.message}>
            {message}
          </Text>

          {calls.length > 0 && (
            <>
              <View style={styles.calls}>
                {calls.map((call, i) =>
                  call === '112' ? (
                    <CallButton
                      key={call}
                      testID={id(i === 0 ? '-call' : '-112', 'urgency-call-112')}
                      label="Ligar 112"
                      accessibilityLabel={strings.urgency.emergencyCta}
                      primary={i === 0}
                      onPress={() => Linking.openURL(EMERGENCY_TEL)}
                    />
                  ) : (
                    <CallButton
                      key={call}
                      testID={id(i === 0 ? '-call' : '-sns24', 'urgency-call-sns24')}
                      label="Ligar SNS 24"
                      accessibilityLabel={snsAccessibilityLabel}
                      primary={i === 0}
                      onPress={() => Linking.openURL(SNS24_TEL)}
                    />
                  )
                )}
              </View>

              <View style={styles.divider} />
            </>
          )}

          <Pressable
            testID={id('-dismiss', 'urgency-dismiss')}
            accessibilityRole="button"
            onPress={onDismiss}
            style={({ pressed }) => [styles.continue, pressed && styles.pressed]}
          >
            <Text style={styles.continueText}>{dismissLabel}</Text>
            <Icon name={{ sf: 'arrow.right', ion: 'arrow-forward' }} size={16} color={theme.colors.inkText} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

type CallButtonProps = {
  label: string;
  accessibilityLabel: string;
  primary?: boolean;
  onPress: () => void;
  testID: string;
};

function CallButton({ label, accessibilityLabel, primary, onPress, testID }: CallButtonProps) {
  const { theme } = useUnistyles();
  const color = primary ? theme.colors.onInk : theme.colors.inkText;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.call,
        primary ? styles.callPrimary : styles.callOutline,
        pressed && styles.pressed,
      ]}
    >
      {/* Same fixed width in both buttons: the icons and labels line up with
          each other while the group stays centred in the button. */}
      <View style={styles.callContent}>
        <Icon name={PHONE_ICON} size={18} color={color} />
        <Text style={[styles.callText, { color }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.xl,
    borderCurve: 'continuous',
    padding: theme.spacing.lg,
  },
  iconChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.butter,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  title: { fontFamily: fonts.displayBold, fontSize: 22, color: theme.colors.inkText },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.lg,
  },
  calls: { gap: theme.spacing.sm },
  call: {
    minHeight: 48,
    borderRadius: theme.radius.pill,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  callPrimary: { backgroundColor: theme.colors.ink },
  callOutline: { borderWidth: 1.5, borderColor: theme.colors.borderStrong },
  callContent: { width: 140, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  callText: { fontFamily: fonts.displayBold, fontSize: 16 },
  divider: {
    height: 1,
    backgroundColor: theme.colors.divider,
    marginVertical: theme.spacing.md,
  },
  continue: {
    minHeight: 48,
    borderRadius: theme.radius.pill,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surfaceSunken,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  continueText: { fontFamily: fonts.displayBold, fontSize: 16, color: theme.colors.inkText },
  pressed: { opacity: 0.85 },
}));
