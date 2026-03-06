import { FlatList, View, Text, Pressable } from 'react-native';
import { useQuery } from 'convex/react';
import { useRouter, useSegments } from 'expo-router';
import { api } from '@/convex/_generated/api';
import { colors, spacing, typography, radius } from '@/constants/theme';
import { TOPICS } from '@/constants/topics';

export function EducationScreen() {
  const articles = useQuery(api.education.listByTopic, {}) ?? [];
  const router = useRouter();
  const segments = useSegments();
  const isPatient = segments[0] === '(patient)';
  const basePath = isPatient ? '/(patient)/education' : '/(professional)/education';

  return (
    <FlatList
      data={articles}
      keyExtractor={(item) => item._id}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
      contentInsetAdjustmentBehavior="automatic"
      ListEmptyComponent={
        <View style={{ padding: spacing.xl, alignItems: 'center', gap: spacing.md }}>
          <Text style={{ fontSize: 48 }}>📚</Text>
          <Text style={{ ...typography.base, color: colors.text.secondary, textAlign: 'center' }}>
            Ainda não há conteúdos disponíveis.
          </Text>
        </View>
      }
      renderItem={({ item }) => {
        const topic = TOPICS.find((t) => t.id === item.topic);
        return (
          <Pressable
            onPress={() => router.push(`${basePath}/${item._id}`)}
            style={({ pressed }) => ({
              backgroundColor: pressed ? colors.background.tertiary : colors.background.primary,
              borderRadius: radius.md,
              padding: spacing.md,
              borderWidth: 1,
              borderColor: colors.border,
              gap: spacing.xs,
            })}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ backgroundColor: colors.primaryLight, paddingVertical: 2, paddingHorizontal: spacing.sm, borderRadius: radius.full }}>
                <Text style={{ ...typography.xs, fontWeight: '600', color: colors.primary }}>
                  {topic?.emoji} {topic?.label ?? item.topic}
                </Text>
              </View>
              <Text style={{ ...typography.xs, color: colors.text.tertiary }}>
                {item.readingTimeMinutes} min
              </Text>
            </View>
            <Text style={{ ...typography.base, fontWeight: '600', color: colors.text.primary }}>
              {item.title}
            </Text>
            <Text style={{ ...typography.sm, color: colors.text.secondary }} numberOfLines={2}>
              {item.summary}
            </Text>
          </Pressable>
        );
      }}
    />
  );
}
