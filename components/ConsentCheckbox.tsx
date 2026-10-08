import { Pressable, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '@/components/ui/Icon';

type Props = { checked: boolean; onChange: (checked: boolean) => void; testID?: string };

// Required before creating an account or entering without one: age (18+) and
// the privacy policy (consent to process health data).
export function ConsentCheckbox({ checked, onChange, testID }: Props) {
  const { theme } = useUnistyles();
  return (
    <View style={styles.row}>
      <Pressable
        testID={testID}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        aria-checked={checked}
        accessibilityLabel="Confirmo que tenho 18 anos ou mais e li a política de privacidade"
        onPress={() => onChange(!checked)}
        hitSlop={8}
        style={[styles.box, checked && styles.boxOn]}
      >
        {checked && <Icon name={{ sf: 'checkmark', ion: 'checkmark' }} size={16} color={theme.colors.onInk} />}
      </Pressable>
      <Text style={styles.text} onPress={() => onChange(!checked)}>
        Confirmo que tenho 18 anos ou mais e li a{' '}
        <Link href="/privacidade" style={styles.link} accessibilityRole="link">
          política de privacidade
        </Link>
        .
      </Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm },
  box: {
    width: 24,
    height: 24,
    marginTop: 1,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.colors.inkText,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: theme.colors.ink, borderColor: theme.colors.ink },
  text: { flex: 1, fontSize: 15, lineHeight: 22, color: theme.colors.textPrimary },
  link: { color: theme.colors.inkText, fontWeight: '600', textDecorationLine: 'underline' },
}));
