import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { TOPICS } from '@/constants/topics';
import { Icon } from '@/components/ui/Icon';
import { colors, spacing, typography, radius } from '@/constants/theme';

export default function PatientHome() {
  const router = useRouter();

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }}
      contentInsetAdjustmentBehavior="automatic"
    >
      <View style={{ gap: spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={{ ...typography['2xl'], fontWeight: '700', color: colors.text.primary }}>
            Olá
          </Text>
          <Icon name={{ sf: 'hand.wave.fill', ion: 'hand-left' }} size={28} color={colors.primary} />
        </View>
        <Text style={{ ...typography.base, color: colors.text.secondary }}>
          Sobre o que precisas de ajuda hoje?
        </Text>
      </View>

      <View style={{ gap: spacing.md }}>
        {TOPICS.map((topic) => (
          <Pressable
            key={topic.id}
            onPress={() =>
              router.push({
                pathname: '/(patient)/triage',
                params: { topic: topic.id },
              })
            }
            style={({ pressed }) => ({
              backgroundColor: pressed
                ? colors.background.tertiary
                : colors.background.primary,
              borderRadius: radius.lg,
              padding: spacing.lg,
              borderWidth: 1,
              borderColor: colors.border,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            })}
          >
            <Icon name={topic.icon} size={36} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  ...typography.lg,
                  fontWeight: '600',
                  color: colors.text.primary,
                }}
              >
                {topic.label}
              </Text>
              <Text style={{ ...typography.sm, color: colors.text.secondary }}>
                {topic.description}
              </Text>
            </View>
            <Text style={{ color: colors.text.tertiary, fontSize: 20 }}>›</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
