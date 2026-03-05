import { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthActions } from '@convex-dev/auth/react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { colors, spacing, typography } from '@/constants/theme';
import { strings } from '@/constants/strings';

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
          label={strings.auth.email}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="email@exemplo.pt"
        />
        <Input
          label={strings.auth.password}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <Input
          label={strings.auth.confirmPassword}
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
        />
        {error ? (
          <Text style={{ ...typography.sm, color: colors.danger }}>{error}</Text>
        ) : null}
        <Button label={strings.auth.register} onPress={handleRegister} loading={loading} />
      </View>

      <Pressable onPress={() => router.back()}>
        <Text style={{ ...typography.sm, color: colors.primary, textAlign: 'center' }}>
          {strings.auth.hasAccount} {strings.auth.login}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
