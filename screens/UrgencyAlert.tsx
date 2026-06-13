import { View, Text, Pressable } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { strings } from '@/constants/strings';
import { fonts } from '@/lib/fonts';

type Props = {
  onDismiss: () => void;
};

export function UrgencyAlert({ onDismiss }: Props) {
  return (
    <View testID="urgency-alert" style={styles.card}>
      <Text style={styles.title}>⚠️ {strings.urgency.title}</Text>
      <Text style={styles.message}>{strings.urgency.message}</Text>
      <View style={styles.contacts}>
        <Text style={styles.contactsLabel}>Contactos de emergência:</Text>
        <Text style={styles.sns} selectable>SNS 24: 808 24 24 24</Text>
        <Text style={styles.emergency} selectable>Emergência: 112</Text>
      </View>
      <Pressable testID="urgency-dismiss" onPress={onDismiss}>
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
  title: { fontFamily: fonts.displayBold, fontSize: 18, color: theme.colors.danger },
  message: { fontSize: 16, color: theme.colors.textPrimary, lineHeight: 24 },
  contacts: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  contactsLabel: { fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },
  sns: { fontSize: 16, color: theme.colors.ink, fontWeight: '500' },
  emergency: { fontSize: 16, color: theme.colors.danger, fontWeight: '500' },
  dismiss: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
}));
