import { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthActions } from '@convex-dev/auth/react';
import { StyleSheet } from 'react-native-unistyles';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { strings } from '@/constants/strings';
import { fonts } from '@/lib/fonts';

export default function Register() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleRegister() {
    setError('');
    if (password !== confirm) {
      setError(strings.errors.passwordMismatch);
      return;
    }
    setLoading(true);
    try {
      await signIn('password', { email, password, flow: 'signUp' });
      router.replace('/');
    } catch {
      setError(strings.errors.generic);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Text style={styles.title}>Criar conta</Text>

      <View style={styles.form}>
        <Input
          testID="auth-email-input"
          label={strings.auth.email}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="email@exemplo.pt"
        />
        <Input
          testID="auth-password-input"
          label={strings.auth.password}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
        />
        <Input
          testID="auth-password-confirm-input"
          label={strings.auth.confirmPassword}
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          autoComplete="new-password"
        />
        {error ? (
          <Text testID="auth-error" accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}
        <Button
          testID="auth-register-button"
          label={strings.auth.register}
          onPress={handleRegister}
          loading={loading}
        />
      </View>

      <Pressable
        accessibilityRole="link"
        testID="auth-back-link"
        onPress={() => router.back()}
        hitSlop={8}
      >
        <Text style={styles.backLink}>
          {strings.auth.hasAccount}{' '}
          <Text style={styles.backLinkStrong}>{strings.auth.login}</Text>
        </Text>
      </Pressable>

      <Pressable
        accessibilityRole="link"
        onPress={() => router.push('/(auth)/professional-signup')}
        style={({ pressed }) => [styles.proLink, pressed && styles.dim]}
        hitSlop={8}
      >
        <Icon
          name={{ sf: 'stethoscope', ion: 'medkit' }}
          size={16}
          color={styles.proLinkText.color}
        />
        <Text style={styles.proLinkText}>Sou profissional de saúde →</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    flexGrow: 1,
    padding: theme.spacing.lg,
    justifyContent: 'center',
    gap: theme.spacing.lg,
  },
  title: { fontFamily: fonts.displayExtraBold, fontSize: 28, color: theme.colors.ink },
  form: { gap: theme.spacing.md },
  error: { fontSize: 14, color: theme.colors.danger },
  backLink: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center' },
  backLinkStrong: { color: theme.colors.accent, fontWeight: '500' },
  proLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
  },
  dim: { opacity: 0.7 },
  proLinkText: { fontSize: 14, color: theme.colors.textSecondary, fontWeight: '500' },
}));
