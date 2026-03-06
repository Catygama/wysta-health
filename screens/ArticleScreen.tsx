import { ScrollView, View, Text, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { colors, spacing, typography } from '@/constants/theme';

export function ArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const article = useQuery(api.education.get, id ? { id: id as any } : 'skip');

  if (article === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!article) return null;

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Text style={{ ...typography['2xl'], fontWeight: '700', color: colors.text.primary }}>
        {article.title}
      </Text>
      <Text style={{ ...typography.sm, color: colors.text.secondary }}>
        Leitura: {article.readingTimeMinutes} min
      </Text>
      <Text style={{ ...typography.base, color: colors.text.primary, lineHeight: 26 }}>
        {article.content}
      </Text>
    </ScrollView>
  );
}
