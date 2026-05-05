import { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthActions } from '@convex-dev/auth/react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { spacing, typography } from '@/constants/theme';
import { strings } from '@/constants/strings';
import { useTheme } from '@/lib/theme';

export default function Register() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const { colors } = useTheme();
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
      contentContainerStyle={{
        flex: 1,
        padding: spacing.lg,
        justifyContent: 'center',
        gap: spacing.lg,
        backgroundColor: colors.background.primary,
      }}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Text style={{ ...typography['2xl'], fontWeight: '700', color: colors.text.primary }}>
        Criar conta
      </Text>

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
        <Input
          testID="auth-password-confirm-input"
          label={strings.auth.confirmPassword}
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
        />
        {error ? (
          <Text testID="auth-error" style={{ ...typography.sm, color: colors.danger }}>{error}</Text>
        ) : null}
        <Button testID="auth-register-button" label={strings.auth.register} onPress={handleRegister} loading={loading} />
      </View>

      <Pressable testID="auth-back-link" onPress={() => router.back()} hitSlop={8}>
        <Text style={{ ...typography.sm, color: colors.primary, textAlign: 'center' }}>
          {strings.auth.hasAccount} {strings.auth.login}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => router.push('/(auth)/professional-signup')}
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
