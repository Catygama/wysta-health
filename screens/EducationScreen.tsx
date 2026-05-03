import { useMemo, useState } from 'react';
import {
  FlatList,
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
} from 'react-native';
import { useQuery } from 'convex/react';
import { useRouter, useSegments } from 'expo-router';
import { api } from '@/convex/_generated/api';
import { colors, spacing, typography, radius } from '@/constants/theme';
import { TOPICS, type TopicId } from '@/constants/topics';
import { Icon } from '@/components/ui/Icon';

export function EducationScreen() {
  const [topicFilter, setTopicFilter] = useState<TopicId | null>(null);
  const [search, setSearch] = useState('');
  const articles = useQuery(api.education.listByTopic, {}) ?? [];
  const router = useRouter();
  const segments = useSegments();
  const isPatient = segments[0] === '(patient)';
  const basePath = isPatient
    ? '/(patient)/education'
    : '/(professional)/education';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return articles.filter((a) => {
      if (topicFilter && a.topic !== topicFilter) return false;
      if (!q) return true;
      return (
        a.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [articles, topicFilter, search]);

  return (
    <FlatList
      data={filtered}
      keyExtractor={(item) => item._id}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
      contentInsetAdjustmentBehavior="automatic"
      ListHeaderComponent={
        <View style={{ gap: spacing.md, paddingBottom: spacing.sm }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
              backgroundColor: colors.background.primary,
            }}
          >
            <Icon
              name={{ sf: 'magnifyingglass', ion: 'search' }}
              size={16}
              color={colors.text.tertiary}
            />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Pesquisar conteúdos..."
              placeholderTextColor={colors.text.tertiary as any}
              style={{
                flex: 1,
                paddingVertical: spacing.sm,
                ...typography.base,
                color: colors.text.primary,
              }}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm }}
          >
            <FilterChip
              label="Todos"
              active={topicFilter === null}
              onPress={() => setTopicFilter(null)}
            />
            {TOPICS.map((topic) => (
              <FilterChip
                key={topic.id}
                label={topic.label}
                icon={topic.icon}
                active={topicFilter === topic.id}
                onPress={() => setTopicFilter(topic.id)}
              />
            ))}
          </ScrollView>
        </View>
      }
      ListEmptyComponent={
        <View
          style={{
            padding: spacing.xl,
            alignItems: 'center',
            gap: spacing.md,
          }}
        >
          <Icon
            name={{ sf: 'book.fill', ion: 'book-outline' }}
            size={48}
            color={colors.text.tertiary}
          />
          <Text
            style={{
              ...typography.base,
              color: colors.text.secondary,
              textAlign: 'center',
            }}
          >
            {search || topicFilter
              ? 'Nenhum conteúdo encontrado para esta pesquisa.'
              : 'Ainda não há conteúdos disponíveis.'}
          </Text>
        </View>
      }
      ListFooterComponent={
        filtered.length > 0 ? (
          <View
            style={{
              backgroundColor: colors.background.secondary,
              borderRadius: radius.md,
              padding: spacing.md,
              marginTop: spacing.md,
              gap: spacing.xs,
              flexDirection: 'row',
            }}
          >
            <Icon
              name={{ sf: 'info.circle', ion: 'information-circle' }}
              size={18}
              color={colors.text.secondary}
            />
            <Text
              style={{
                ...typography.xs,
                color: colors.text.secondary,
                flex: 1,
              }}
            >
              A informação disponibilizada é educativa e não substitui aconselhamento médico. Em caso de urgência liga 112 ou contacta o SNS 24.
            </Text>
          </View>
        ) : null
      }
      renderItem={({ item }) => {
        const topic = TOPICS.find((t) => t.id === item.topic);
        return (
          <Pressable
            onPress={() => router.push(`${basePath}/${item._id}`)}
            style={({ pressed }) => ({
              backgroundColor: pressed
                ? colors.background.tertiary
                : colors.background.primary,
              borderRadius: radius.md,
              padding: spacing.md,
              borderWidth: 1,
              borderColor: colors.border,
              gap: spacing.xs,
            })}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  backgroundColor: colors.primaryLight,
                  paddingVertical: 2,
                  paddingHorizontal: spacing.sm,
                  borderRadius: radius.full,
                }}
              >
                {topic && (
                  <Icon name={topic.icon} size={12} color={colors.primary} />
                )}
                <Text
                  style={{
                    ...typography.xs,
                    fontWeight: '600',
                    color: colors.primary,
                  }}
                >
                  {topic?.label ?? item.topic}
                </Text>
              </View>
              <Text
                style={{ ...typography.xs, color: colors.text.tertiary }}
              >
                {item.readingTimeMinutes} min
              </Text>
            </View>
            <Text
              style={{
                ...typography.base,
                fontWeight: '600',
                color: colors.text.primary,
              }}
            >
              {item.title}
            </Text>
            <Text
              style={{ ...typography.sm, color: colors.text.secondary }}
              numberOfLines={2}
            >
              {item.summary}
            </Text>
          </Pressable>
        );
      }}
    />
  );
}

type ChipProps = {
  label: string;
  icon?: { sf: any; ion: any };
  active: boolean;
  onPress: () => void;
};

function FilterChip({ label, icon, active, onPress }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.md,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
        backgroundColor: active
          ? colors.primary
          : pressed
            ? colors.background.tertiary
            : colors.background.primary,
      })}
    >
      {icon && (
        <Icon name={icon} size={14} color={active ? '#fff' : colors.primary} />
      )}
      <Text
        style={{
          ...typography.sm,
          fontWeight: '600',
          color: active ? '#fff' : colors.text.primary,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
