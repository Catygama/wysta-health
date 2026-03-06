import { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/Button';
import { colors, spacing, typography, radius } from '@/constants/theme';

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
  const [ageRange, setAgeRange] = useState('');
  const [pregnancyStatus, setPregnancyStatus] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleContinue() {
    setLoading(true);
    try {
      await ensureProfile();
      await updateProfile({ ageRange, pregnancyStatus });
      router.replace('/');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }}
      contentInsetAdjustmentBehavior="automatic"
    >
      <View style={{ gap: spacing.sm }}>
        <Text style={{ ...typography['2xl'], fontWeight: '700', color: colors.text.primary }}>
          Bem-vinda à Wysta
        </Text>
        <Text style={{ ...typography.base, color: colors.text.secondary }}>
          Algumas perguntas rápidas para personalizarmos a tua experiência.
        </Text>
      </View>

      <View style={{ gap: spacing.md }}>
        <Text style={{ ...typography.base, fontWeight: '600', color: colors.text.primary }}>
          Qual a tua faixa etária?
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {AGE_RANGES.map((age) => (
            <Pressable
              key={age}
              onPress={() => setAgeRange(age)}
              style={{
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
                borderRadius: radius.full,
                borderWidth: 1.5,
                borderColor: ageRange === age ? colors.primary : colors.border,
                backgroundColor:
                  ageRange === age ? colors.primaryLight : colors.background.primary,
              }}
            >
              <Text
                style={{
                  ...typography.sm,
                  fontWeight: '500',
                  color: ageRange === age ? colors.primary : colors.text.secondary,
                }}
              >
                {age}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={{ gap: spacing.md }}>
        <Text style={{ ...typography.base, fontWeight: '600', color: colors.text.primary }}>
          Estado de gravidez atual
        </Text>
        {PREGNANCY_OPTIONS.map((opt) => (
          <Pressable
            key={opt.value}
            onPress={() => setPregnancyStatus(opt.value)}
            style={{
              padding: spacing.md,
              borderRadius: radius.md,
              borderWidth: 1.5,
              borderColor:
                pregnancyStatus === opt.value ? colors.primary : colors.border,
              backgroundColor:
                pregnancyStatus === opt.value
                  ? colors.primaryLight
                  : colors.background.primary,
            }}
          >
            <Text
              style={{
                ...typography.base,
                color:
                  pregnancyStatus === opt.value
                    ? colors.primary
                    : colors.text.primary,
              }}
            >
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Button
        label="Continuar"
        onPress={handleContinue}
        loading={loading}
        disabled={!ageRange || !pregnancyStatus}
      />
    </ScrollView>
  );
}
