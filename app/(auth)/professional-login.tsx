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

export default function ProfessionalLogin() {
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
      // Profile is created server-side by afterUserCreatedOrUpdated.
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
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
          }}
        >
          <Icon
            name={{ sf: 'stethoscope', ion: 'medkit' }}
            size={28}
            color={colors.primary}
          />
          <Text
            style={{
              ...typography['2xl'],
              fontWeight: '700',
              color: colors.text.primary,
            }}
          >
            Profissional
          </Text>
        </View>
        <Text style={{ ...typography.base, color: colors.text.secondary }}>
          Acesso para profissionais de saúde verificados.
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
          <Text testID="auth-error" style={{ ...typography.sm, color: colors.danger }}>
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
        <View style={{ gap: spacing.sm }}>
          <Divider label="ou" />
          <Button
            testID="auth-professional-guest-button"
            label="Entrar como profissional convidado"
            variant="secondary"
            onPress={handleGuest}
            loading={guestLoading}
          />
          <Text
            style={{
              ...typography.xs,
              color: colors.text.tertiary,
              textAlign: 'center',
            }}
          >
            Modo de teste — auto-verificado, sem cédula real.
          </Text>
        </View>
      )}

      <Pressable
        testID="auth-professional-signup-link"
        onPress={() => router.push('/(auth)/professional-signup')}
        hitSlop={8}
      >
        <Text
          style={{
            ...typography.sm,
            color: colors.primary,
            textAlign: 'center',
          }}
        >
          Ainda não tens conta? Pedir verificação
        </Text>
      </Pressable>

      <Pressable
        testID="auth-back-to-patient-link"
        onPress={() => router.replace('/(auth)/login')}
        style={{ paddingVertical: spacing.sm }}
        hitSlop={8}
      >
        <Text
          style={{
            ...typography.sm,
            color: colors.text.secondary,
            textAlign: 'center',
          }}
        >
          ← Voltar à entrada para utentes
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
