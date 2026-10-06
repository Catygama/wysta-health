import { Linking, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '@/components/ui/Icon';
import { strings } from '@/constants/strings';

const EMERGENCY_TEL = 'tel:112';
const SNS24_TEL = 'tel:808242424';

// "This is an academic prototype, not a real clinical service" notice. The
// emergency numbers are tappable so a phone opens the dialler pre-filled.
export function AcademicNotice() {
  const { theme } = useUnistyles();
  return (
    <View testID="academic-notice" style={styles.card}>
      <Icon
        name={{ sf: 'graduationcap', ion: 'school-outline' }}
        size={18}
        color={theme.colors.inkText}
      />
      <View style={styles.body}>
        <Text style={styles.title}>{strings.academic.title}</Text>
        <Text style={styles.message}>
          {strings.academic.message} {strings.academic.emergencyLead}{' '}
          <Text
            testID="academic-call-112"
            accessibilityRole="link"
            accessibilityLabel="Ligar 112"
            onPress={() => Linking.openURL(EMERGENCY_TEL)}
            style={styles.tel}
          >
            112
          </Text>{' '}
          {strings.academic.emergencyOr}{' '}
          <Text
            testID="academic-call-sns24"
            accessibilityRole="link"
            accessibilityLabel="Ligar SNS 24, 808 24 24 24"
            onPress={() => Linking.openURL(SNS24_TEL)}
            style={styles.tel}
          >
            SNS 24 (808 24 24 24)
          </Text>
          .
        </Text>
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
  // Same text style; underline + brand color is the only cue that it's tappable.
  tel: { color: theme.colors.inkText, textDecorationLine: 'underline' },
}));
