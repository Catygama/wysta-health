import { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthActions } from '@convex-dev/auth/react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { spacing, typography } from '@/constants/theme';
import { strings } from '@/constants/strings';
import { guestAuthEnabled } from '@/lib/env';
import { useTheme } from '@/lib/theme';

export default function Login() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const { colors } = useTheme();
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
      // Profile is created server-side by the afterUserCreatedOrUpdated
      // callback in convex/auth.ts; no follow-up mutation needed.
      await signIn('anonymous');
      router.replace('/');
    } catch (e: any) {
      const message = e?.message ?? String(e);
      setError(`Guest falhou: ${message}`);
    } finally {
      setGuestLoading(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={{
        flex: 1,
        padding: spacing.lg,
        justifyContent: 'center',
        gap: spacing.lg,
        backgroundColor: colors.background.primary,
      }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ gap: spacing.xs }}>
        <Text
          style={{
            ...typography['2xl'],
            fontWeight: '700',
            color: colors.text.primary,
          }}
        >
          {strings.app.name}
        </Text>
        <Text style={{ ...typography.base, color: colors.text.secondary }}>
          Saúde sexual e reprodutiva, com privacidade.
        </Text>
      </View>

      <View style={{ gap: spacing.md }}>
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
        />
        {error ? (
          <Text testID="auth-error" style={{ ...typography.sm, color: colors.danger }}>
            {error}
          </Text>
        ) : null}
        <Button
          testID="auth-login-button"
          label={strings.auth.login}
          onPress={handleLogin}
          loading={loading}
        />
      </View>

      {guestAuthEnabled && (
        <View style={{ gap: spacing.sm }}>
          <Divider label="ou" />
          <Button
            testID="auth-guest-button"
            label="Entrar como convidada"
            variant="secondary"
            onPress={handleGuest}
            loading={guestLoading}
          />
        </View>
      )}

      <Pressable testID="auth-register-link" onPress={() => router.push('/(auth)/register')} hitSlop={8}>
        <Text
          style={{
            ...typography.sm,
            color: colors.primary,
            textAlign: 'center',
          }}
        >
          {strings.auth.noAccount} {strings.auth.register}
        </Text>
      </Pressable>

      <Pressable
        testID="auth-professional-link"
        onPress={() => router.push('/(auth)/professional-login')}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.xs,
          paddingVertical: spacing.sm,
          opacity: pressed ? 0.7 : 1,
        })}
        hitSlop={8}
      >
        <Icon
          name={{ sf: 'stethoscope', ion: 'medkit' }}
          size={16}
          color={colors.text.secondary}
        />
        <Text
          style={{
            ...typography.sm,
            color: colors.text.secondary,
            fontWeight: '500',
          }}
        >
          Sou profissional de saúde →
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function Divider({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
      }}
    >
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      <Text style={{ ...typography.xs, color: colors.text.tertiary }}>
        {label}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
    </View>
  );
}
