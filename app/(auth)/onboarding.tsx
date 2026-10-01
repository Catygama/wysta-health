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
const PREGNANCY_OPTIONS = [
  { value: 'not-pregnant', label: 'Não estou grávida' },
  { value: 'pregnant', label: 'Estou grávida' },
  { value: 'trying', label: 'Estou a tentar engravidar' },
  { value: 'prefer-not-to-say', label: 'Prefiro não dizer' },
];

export default function Onboarding() {
  const router = useRouter();
  const ensureProfile = useMutation(api.users.ensureProfile);
  const updateProfile = useMutation(api.users.updateProfile);
  const [displayName, setDisplayName] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [pregnancyStatus, setPregnancyStatus] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleContinue() {
    setLoading(true);
    try {
      await ensureProfile({});
      await updateProfile({
        displayName: displayName.trim() || undefined,
        ageRange,
        pregnancyStatus,
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

      <View style={styles.section}>
        <Text style={styles.label}>Estado de gravidez atual</Text>
        {PREGNANCY_OPTIONS.map((opt) => {
          const selected = pregnancyStatus === opt.value;
          return (
            <Pressable
              key={opt.value}
              testID={`onboarding-pregnancy-${opt.value}`}
              onPress={() => setPregnancyStatus(opt.value)}
              style={[styles.option, selected ? styles.optionOn : styles.optionOff]}
            >
              <Text style={[styles.optionText, selected ? styles.pillTextOn : styles.optionTextOff]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.actions}>
        <Button
          testID="onboarding-continue-button"
          label="Continuar"
          onPress={handleContinue}
          loading={loading}
          disabled={!ageRange || !pregnancyStatus}
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
  option: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
  },
  optionOn: { backgroundColor: theme.colors.ink },
  optionOff: { backgroundColor: theme.colors.surface },
  optionText: { fontSize: 16 },
  optionTextOff: { color: theme.colors.textPrimary },
  actions: { gap: theme.spacing.sm },
}));
