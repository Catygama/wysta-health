import { ScrollView, View, Text, ActivityIndicator } from 'react-native';
import { Stack, useLocalSearchParams, useRouter, useSegments } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { TOPICS } from '@/constants/topics';
import { colors, spacing, typography, radius } from '@/constants/theme';

export function ArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const article = useQuery(
    api.education.get,
    id ? { id: id as any } : 'skip'
  );
  const router = useRouter();
  const segments = useSegments();
  const isPatient = segments[0] === '(patient)';

  if (article === undefined) {
    return (
      <View
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!article) return null;

  const topic = TOPICS.find((t) => t.id === article.topic);

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Stack.Screen options={{ title: topic?.label ?? 'Artigo' }} />
      <View style={{ gap: spacing.sm }}>
        {topic && (
          <View
            style={{
              flexDirection: 'row',
              alignSelf: 'flex-start',
              alignItems: 'center',
              gap: spacing.xs,
              backgroundColor: colors.primaryLight,
              paddingVertical: spacing.xs,
              paddingHorizontal: spacing.sm,
              borderRadius: radius.full,
            }}
          >
            <Icon name={topic.icon} size={14} color={colors.primary} />
            <Text
              style={{
                ...typography.xs,
                fontWeight: '600',
                color: colors.primary,
              }}
            >
              {topic.label}
            </Text>
          </View>
        )}

        <Text
          style={{
            ...typography['2xl'],
            fontWeight: '700',
            color: colors.text.primary,
          }}
        >
          {article.title}
        </Text>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
          }}
        >
          <Icon
            name={{ sf: 'clock', ion: 'time-outline' }}
            size={14}
            color={colors.text.tertiary}
          />
          <Text style={{ ...typography.sm, color: colors.text.secondary }}>
            {article.readingTimeMinutes} min de leitura
          </Text>
        </View>

        {article.summary && (
          <Text
            style={{
              ...typography.base,
              color: colors.text.secondary,
              fontStyle: 'italic',
            }}
          >
            {article.summary}
          </Text>
        )}
      </View>

      <Text
        style={{
          ...typography.base,
          color: colors.text.primary,
          lineHeight: 26,
        }}
      >
        {article.content}
      </Text>

      {article.whenToSeekHelp && (
        <View
          style={{
            backgroundColor: colors.dangerLight,
            borderWidth: 1,
            borderColor: colors.danger,
            borderRadius: radius.lg,
            padding: spacing.lg,
            gap: spacing.sm,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
            }}
          >
            <Icon
              name={{
                sf: 'exclamationmark.triangle.fill',
                ion: 'warning',
              }}
              size={20}
              color={colors.danger}
            />
            <Text
              style={{
                ...typography.lg,
                fontWeight: '700',
                color: colors.danger,
              }}
            >
              Quando procurar ajuda
            </Text>
          </View>
          <Text
            style={{
              ...typography.base,
              color: colors.text.primary,
              lineHeight: 24,
            }}
          >
            {article.whenToSeekHelp}
          </Text>
        </View>
      )}

      {article.tags.length > 0 && (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.xs,
          }}
        >
          {article.tags.map((tag) => (
            <View
              key={tag}
              style={{
                backgroundColor: colors.background.tertiary,
                paddingVertical: 2,
                paddingHorizontal: spacing.sm,
                borderRadius: radius.full,
              }}
            >
              <Text
                style={{
                  ...typography.xs,
                  color: colors.text.secondary,
                }}
              >
                #{tag}
              </Text>
            </View>
          ))}
        </View>
      )}

      {isPatient && (
        <View
          style={{
            backgroundColor: colors.primaryLight,
            borderRadius: radius.lg,
            padding: spacing.lg,
            gap: spacing.sm,
          }}
        >
          <Text
            style={{
              ...typography.base,
              fontWeight: '600',
              color: colors.text.primary,
            }}
          >
            Precisas de apoio personalizado?
          </Text>
          <Text
            style={{ ...typography.sm, color: colors.text.secondary }}
          >
            Fala com um profissional de saúde sobre {topic?.label.toLowerCase() ?? 'este tema'}.
          </Text>
          <Button
            label="Iniciar conversa"
            onPress={() =>
              router.push({
                pathname: '/(patient)/triage',
                params: { topic: article.topic },
              })
            }
          />
        </View>
      )}
    </ScrollView>
  );
}
