import { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation } from 'convex/react';
import { StyleSheet } from 'react-native-unistyles';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { fonts } from '@/lib/fonts';

const AGE_RANGES = ['18-25', '26-35', '36-45', '46+'];

export default function Onboarding() {
  const router = useRouter();
  const ensureProfile = useMutation(api.users.ensureProfile);
  const updateProfile = useMutation(api.users.updateProfile);
  const [displayName, setDisplayName] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleContinue() {
    setLoading(true);
    try {
      await ensureProfile({});
      await updateProfile({
        displayName: displayName.trim() || undefined,
        ageRange,
      });
      router.replace('/');
    } finally {
      setLoading(false);
    }
  }

  async function handleSkip() {
    setLoading(true);
    try {
      await ensureProfile({});
      router.replace('/');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.hero}>
        <Text style={styles.title}>Boas-vindas à Wysta</Text>
        <Text style={styles.sub}>
          Algumas perguntas rápidas para personalizarmos a tua experiência. Podes
          saltar e completar mais tarde.
        </Text>
      </View>

      <Input
        testID="onboarding-name-input"
        label="Como queres que te chamemos? (opcional)"
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="ex.: Maria"
        autoCapitalize="words"
      />

      <View style={styles.section}>
        <Text style={styles.label}>Faixa etária</Text>
        <View style={styles.pillRow}>
          {AGE_RANGES.map((age) => {
            const selected = ageRange === age;
            return (
              <Pressable
                key={age}
                testID={`onboarding-age-${age}`}
                onPress={() => setAgeRange(age)}
                style={[styles.pill, selected ? styles.pillOn : styles.pillOff]}
              >
                <Text style={[styles.pillText, selected ? styles.pillTextOn : styles.pillTextOff]}>
                  {age}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.actions}>
        <Button
          testID="onboarding-continue-button"
          label="Continuar"
          onPress={handleContinue}
          loading={loading}
          disabled={!ageRange}
        />
        <Button
          testID="onboarding-skip-button"
          label="Saltar por agora"
          variant="secondary"
          onPress={handleSkip}
          loading={loading}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, gap: theme.spacing.xl },
  hero: { gap: theme.spacing.sm },
  title: { fontFamily: fonts.displayExtraBold, fontSize: 28, color: theme.colors.inkText },
  sub: { fontSize: 16, color: theme.colors.textSecondary },
  section: { gap: theme.spacing.md },
  label: { fontFamily: fonts.displayBold, fontSize: 16, color: theme.colors.textPrimary },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  pill: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.pill,
    borderCurve: 'continuous',
  },
  pillOn: { backgroundColor: theme.colors.ink },
  pillOff: { backgroundColor: theme.colors.surface },
  pillText: { fontSize: 14, fontWeight: '500' },
  pillTextOn: { color: theme.colors.onInk },
  pillTextOff: { color: theme.colors.textSecondary },
  actions: { gap: theme.spacing.sm },
}));
