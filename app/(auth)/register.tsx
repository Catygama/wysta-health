import { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useAuthActions } from '@convex-dev/auth/react';
import { useConvexAuth } from 'convex/react';
import { StyleSheet } from 'react-native-unistyles';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { strings } from '@/constants/strings';
import { fonts } from '@/lib/fonts';
import { AcademicNotice } from '@/components/AcademicNotice';
import { ConsentCheckbox } from '@/components/ConsentCheckbox';
import { useConsentAfterSignIn } from '@/hooks/useConsentAfterSignIn';

export default function Register() {
  const { signIn } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const consentRecord = useConsentAfterSignIn();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [consent, setConsent] = useState(false);

  async function handleRegister() {
    setError('');
    if (password !== confirm) {
      setError(strings.errors.passwordMismatch);
      return;
    }
    if (!consent) {
      setError('Para criar conta, confirma que tens 18 anos ou mais e que leste a política de privacidade.');
      return;
    }
    setLoading(true);
    try {
      // Set before signing in: the session can become active before signIn() resolves.
      consentRecord.markPending('registo');
      await signIn('password', { email, password, flow: 'signUp' });
    } catch {
      setError(strings.errors.generic);
    } finally {
      setLoading(false);
    }
  }


  // Navigate once the session is actually active: redirecting right after
  // signIn() resolves races the auth state and bounces back to login.
  if (isAuthenticated && consentRecord.ready) return <Redirect href="/" />;
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Text style={styles.title}>Criar conta</Text>

      <AcademicNotice />

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
        <ConsentCheckbox testID="auth-consent-checkbox" checked={consent} onChange={setConsent} />
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
        <Text style={styles.proLinkText}>Sou enfermeiro/a →</Text>
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
  title: { fontFamily: fonts.displayExtraBold, fontSize: 28, color: theme.colors.inkText },
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
