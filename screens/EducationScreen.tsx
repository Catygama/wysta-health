import { useMemo, useState } from 'react';
import { FlatList, View, Text, Pressable, TextInput } from 'react-native';
import { useQuery } from 'convex/react';
import { useRouter, useSegments } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { api } from '@/convex/_generated/api';
import { TOPICS, type TopicId } from '@/constants/topics';
import { Icon } from '@/components/ui/Icon';
import { DropdownMenu } from '@/components/ui/DropdownMenu';
import { Card } from '@/components/ui/Card';

export function EducationScreen() {
  const [topicFilter, setTopicFilter] = useState<TopicId | null>(null);
  const [search, setSearch] = useState('');
  const articles = useQuery(api.education.listByTopic, {}) ?? [];
  const router = useRouter();
  const segments = useSegments();
  const { theme } = useUnistyles();
  const isPatient = segments[0] === '(patient)';
  const basePath = isPatient ? '/(patient)/education' : '/(professional)/library';

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
      style={styles.list}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.searchBar}>
            <Icon
              name={{ sf: 'magnifyingglass', ion: 'search' }}
              size={16}
              color={theme.colors.textTertiary}
            />
            <TextInput
              testID="edu-search"
              value={search}
              onChangeText={setSearch}
              placeholder="Pesquisar conteúdos..."
              placeholderTextColor={theme.colors.textTertiary as any}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
          </View>

          {/* Same quiet dropdown as the professional's queue filters. */}
          <DropdownMenu<TopicId | 'all'>
            testID="edu-topic"
            label={`Tema: ${topicFilter ? (TOPICS.find((t) => t.id === topicFilter)?.label ?? '') : 'todos'}`}
            value={topicFilter ?? 'all'}
            onChange={(v) => setTopicFilter(v === 'all' ? null : v)}
            options={[
              { value: 'all', label: 'Todos' },
              ...TOPICS.map((t) => ({
                value: t.id,
                label: t.label,
                dotColor: theme.topic[t.color].fill,
              })),
            ]}
          />
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Icon
            name={{ sf: 'book.fill', ion: 'book-outline' }}
            size={48}
            color={theme.colors.textTertiary}
          />
          <Text style={styles.emptyText}>
            {search || topicFilter
              ? 'Nenhum conteúdo encontrado para esta pesquisa.'
              : 'Ainda não há conteúdos disponíveis.'}
          </Text>
        </View>
      }
      ListFooterComponent={
        filtered.length > 0 ? (
          <View style={styles.disclaimer}>
            <Icon
              name={{ sf: 'info.circle', ion: 'information-circle' }}
              size={18}
              color={theme.colors.textSecondary}
            />
            <Text style={styles.disclaimerText}>
              A informação disponibilizada é educativa e não substitui
              aconselhamento médico. Em caso de urgência liga 112 ou contacta o
              SNS 24.
            </Text>
          </View>
        ) : null
      }
      renderItem={({ item }) => {
        const topic = TOPICS.find((t) => t.id === item.topic);
        const pastel = theme.topic[topic?.color ?? 'general'];
        return (
          <Card
            testID={`edu-article-${item._id}`}
            onPress={() => router.push(`${basePath}/${item._id}`)}
            style={styles.articleCard}
          >
            <View style={styles.articleHeader}>
              <View style={[styles.topicPill, { backgroundColor: pastel.fill }]}>
                {topic && <Icon name={topic.icon} size={12} color={pastel.on} />}
                <Text style={[styles.topicPillText, { color: pastel.on }]}>
                  {topic?.label ?? item.topic}
                </Text>
              </View>
              <Text style={styles.readingTime}>{item.readingTimeMinutes} min</Text>
            </View>
            <Text style={styles.articleTitle}>{item.title}</Text>
            <Text style={styles.articleSummary} numberOfLines={2}>
              {item.summary}
            </Text>
          </Card>
        );
      }}
    />
  );
}

const styles = StyleSheet.create((theme) => ({
  list: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md, gap: theme.spacing.sm },
  header: { gap: theme.spacing.sm, paddingBottom: theme.spacing.xs },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surfaceSunken,
  },
  searchInput: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  empty: { padding: theme.spacing.xl, alignItems: 'center', gap: theme.spacing.md },
  emptyText: { fontSize: 16, color: theme.colors.textSecondary, textAlign: 'center' },
  disclaimer: {
    backgroundColor: theme.colors.surfaceSunken,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    padding: theme.spacing.md,
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
    flexDirection: 'row',
  },
  disclaimerText: { fontSize: 12, color: theme.colors.textSecondary, flex: 1 },
  articleCard: { gap: theme.spacing.xs },
  articleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topicPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.pill,
  },
  topicPillText: { fontSize: 12, fontWeight: '500' },
  readingTime: { fontSize: 12, color: theme.colors.textTertiary },
  articleTitle: { fontSize: 16, fontWeight: '500', color: theme.colors.textPrimary },
  articleSummary: { fontSize: 14, color: theme.colors.textSecondary },
}));
