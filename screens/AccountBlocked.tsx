import { Text, View } from 'react-native';
import { useAuthActions } from '@convex-dev/auth/react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { fonts } from '@/lib/fonts';

// Shown instead of the app when an admin blocked the account. The server
// already refuses everything else; this only explains it and lets them leave.
export function AccountBlocked() {
  const { signOut } = useAuthActions();
  const { theme } = useUnistyles();
  return (
    <View testID="account-blocked" style={styles.screen}>
      <View style={styles.box}>
        <Icon name={{ sf: 'lock.fill', ion: 'lock-closed' }} size={32} color={theme.colors.inkText} />
        <Text style={styles.title} accessibilityRole="header">
          Conta bloqueada
        </Text>
        <Text style={styles.body}>
          O acesso a esta conta foi bloqueado pela administração da Wysta. Se achas que é um engano,
          contacta a equipa.
        </Text>
        <Button label="Terminar sessão" onPress={() => signOut()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  box: { width: '100%', maxWidth: 420, alignItems: 'center', gap: theme.spacing.md },
  title: { fontFamily: fonts.displayExtraBold, fontSize: 24, color: theme.colors.inkText, textAlign: 'center' },
  body: { fontSize: 16, lineHeight: 24, color: theme.colors.textSecondary, textAlign: 'center' },
}));
