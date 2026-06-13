import { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthActions } from '@convex-dev/auth/react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { strings } from '@/constants/strings';
import { guestAuthEnabled } from '@/lib/env';
import { fonts } from '@/lib/fonts';

export default function ProfessionalLogin() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const { theme } = useUnistyles();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    setError('');
    setLoading(true);
    try {
      await signIn('password', { email, password, flow: 'signIn' });
      router.replace('/');
    } catch {
      setError('Email ou palavra-passe incorretos.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGuest() {
    setError('');
    setGuestLoading(true);
    try {
      await signIn('anonymous-professional');
      router.replace('/');
    } catch (e: any) {
      const message = e?.message ?? String(e);
      setError(`Guest professional falhou: ${message}`);
    } finally {
      setGuestLoading(false);
    }
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.brand}>
        <View style={styles.logo}>
          <Icon name={{ sf: 'stethoscope', ion: 'medkit' }} size={30} color={theme.colors.onInk} />
        </View>
        <Text style={styles.title}>Profissional</Text>
        <Text style={styles.tagline}>Acesso para profissionais de saúde verificados.</Text>
      </View>

      <View style={styles.form}>
        <Input
          testID="auth-email-input"
          label={strings.auth.email}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="email@instituicao.pt"
        />
        <Input
          testID="auth-password-input"
          label={strings.auth.password}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        {error ? (
          <Text testID="auth-error" style={styles.error}>
            {error}
          </Text>
        ) : null}
        <Button
          testID="auth-professional-login-button"
          label={strings.auth.login}
          onPress={handleLogin}
          loading={loading}
        />
      </View>

      {guestAuthEnabled && (
        <View style={styles.guest}>
          <Divider label="ou" />
          <Button
            testID="auth-professional-guest-button"
            label="Entrar como profissional convidado"
            variant="secondary"
            onPress={handleGuest}
            loading={guestLoading}
          />
          <Text style={styles.hint}>Modo de teste — auto-verificado, sem cédula real.</Text>
        </View>
      )}

      <Pressable
        testID="auth-professional-signup-link"
        onPress={() => router.push('/(auth)/professional-signup')}
        hitSlop={8}
      >
        <Text style={styles.link}>Ainda não tens conta? Pedir verificação</Text>
      </Pressable>

      <Pressable
        testID="auth-back-to-patient-link"
        onPress={() => router.replace('/(auth)/login')}
        style={styles.back}
        hitSlop={8}
      >
        <Text style={styles.backText}>← Voltar à entrada para utentes</Text>
      </Pressable>
    </ScrollView>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <View style={styles.divider}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerLabel}>{label}</Text>
      <View style={styles.dividerLine} />
    </View>
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
  brand: { alignItems: 'center', gap: theme.spacing.sm },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xs,
  },
  title: { fontFamily: fonts.displayExtraBold, fontSize: 30, color: theme.colors.ink },
  tagline: { fontSize: 16, color: theme.colors.textSecondary, textAlign: 'center' },
  form: { gap: theme.spacing.md },
  error: { fontSize: 14, color: theme.colors.danger },
  guest: { gap: theme.spacing.sm },
  hint: { fontSize: 12, color: theme.colors.textTertiary, textAlign: 'center' },
  link: { fontSize: 14, color: theme.colors.accent, textAlign: 'center', fontWeight: '500' },
  back: { paddingVertical: theme.spacing.sm },
  backText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  dividerLine: { flex: 1, height: 1, backgroundColor: theme.colors.divider },
  dividerLabel: { fontSize: 12, color: theme.colors.textTertiary },
}));
