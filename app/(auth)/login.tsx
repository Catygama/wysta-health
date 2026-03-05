import { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthActions } from '@convex-dev/auth/react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { colors, spacing, typography } from '@/constants/theme';
import { strings } from '@/constants/strings';

export default function Login() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    setError('');
    setLoading(true);
    try {
      await signIn('password', { email, password, flow: 'signIn' });
    } catch {
      setError('Email ou palavra-passe incorretos.');
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
        {strings.app.name}
      </Text>
      <Text style={{ ...typography.base, color: colors.text.secondary }}>
        Saúde sexual e reprodutiva, com privacidade.
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
        {error ? (
          <Text style={{ ...typography.sm, color: colors.danger }}>{error}</Text>
        ) : null}
        <Button label={strings.auth.login} onPress={handleLogin} loading={loading} />
      </View>

      <Pressable onPress={() => router.push('/(auth)/register')}>
        <Text style={{ ...typography.sm, color: colors.primary, textAlign: 'center' }}>
          {strings.auth.noAccount} {strings.auth.register}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
