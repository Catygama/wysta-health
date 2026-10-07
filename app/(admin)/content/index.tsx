import { useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from 'convex/react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { DropdownMenu } from '@/components/ui/DropdownMenu';
import { TOPICS } from '@/constants/topics';
import { relativeTime } from '@/lib/format';
import { fonts } from '@/lib/fonts';

type TopicFilter = 'all' | (typeof TOPICS)[number]['id'];
type StatusFilter = 'all' | 'published' | 'draft';

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: 'todos',
  published: 'publicados',
  draft: 'rascunhos',
};

// "Conteúdos": the admin writes, edits and publishes the Explorar articles.
export default function AdminContent() {
  const articles = useQuery(api.education.adminList);
  const router = useRouter();
  const { theme } = useUnistyles();
  const [topic, setTopic] = useState<TopicFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');

  const q = search.trim().toLowerCase();
  const filtered = (articles ?? []).filter(
    (a) =>
      (topic === 'all' || a.topic === topic) &&
      (status === 'all' || (status === 'published') === a.isPublished) &&
      (!q || a.title.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q))
  );

  const topicLabel = topic === 'all' ? 'todos' : (TOPICS.find((t) => t.id === topic)?.label ?? topic);

  return (
    <FlatList
      data={filtered}
      keyExtractor={(a) => a._id}
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.titleRow}>
            {Platform.OS === 'web' ? (
              <Text style={styles.title} accessibilityRole="header">
                Conteúdos
              </Text>
            ) : (
              <View />
            )}
            <Button
              testID="content-new-article"
              size="sm"
              label="Novo artigo"
              onPress={() => router.push('/(admin)/content/new')}
            />
          </View>
          <Text style={styles.subtitle}>Artigos do Explorar. Só os publicados aparecem às utentes e aos profissionais.</Text>

          <View style={styles.filters}>
            <DropdownMenu
              testID="content-topic-filter"
              label={`Tema: ${topicLabel}`}
              value={topic}
              onChange={setTopic}
              options={[
                { value: 'all' as TopicFilter, label: 'Todos' },
                ...TOPICS.map((t) => ({ value: t.id as TopicFilter, label: t.label })),
              ]}
            />
            <DropdownMenu
              testID="content-status-filter"
              label={`Estado: ${STATUS_LABELS[status]}`}
              value={status}
              onChange={setStatus}
              options={[
                { value: 'all' as StatusFilter, label: 'Todos' },
                { value: 'published' as StatusFilter, label: 'Publicados' },
                { value: 'draft' as StatusFilter, label: 'Rascunhos' },
              ]}
            />
          </View>

          <View style={styles.searchBar}>
            <Icon name={{ sf: 'magnifyingglass', ion: 'search' }} size={16} color={theme.colors.textTertiary} />
            <TextInput
              testID="content-search"
              value={search}
              onChangeText={setSearch}
              placeholder="Pesquisar artigos..."
              placeholderTextColor={theme.colors.textTertiary as any}
              autoCorrect={false}
              style={styles.searchInput}
            />
          </View>
        </View>
      }
      ListEmptyComponent={
        articles === undefined ? null : (
          <Text style={styles.empty}>Nenhum artigo encontrado.</Text>
        )
      }
      renderItem={({ item }) => {
        const t = TOPICS.find((x) => x.id === item.topic);
        return (
          <Pressable
            testID={`content-article-${item._id}`}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/(admin)/content/[id]', params: { id: item._id } })}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.cardMeta}>
                {t?.label ?? item.topic} · {item.readingTimeMinutes} min · editado {relativeTime(item.editedAt)}
              </Text>
            </View>
            <View style={[styles.pill, item.isPublished ? styles.pillPublished : styles.pillDraft]}>
              <Text style={[styles.pillText, item.isPublished ? styles.pillTextPublished : styles.pillTextDraft]}>
                {item.isPublished ? 'Publicado' : 'Rascunho'}
              </Text>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md, gap: theme.spacing.sm },
  header: { gap: theme.spacing.sm, paddingBottom: theme.spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.md },
  title: { fontFamily: fonts.displayExtraBold, fontSize: 26, color: theme.colors.inkText },
  subtitle: { fontSize: 14, color: theme.colors.textSecondary },
  filters: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: theme.spacing.lg },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceSunken,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    minHeight: 44,
  },
  searchInput: { flex: 1, fontSize: 15, color: theme.colors.textPrimary, paddingVertical: theme.spacing.sm },
  empty: { fontSize: 15, color: theme.colors.textSecondary, textAlign: 'center', padding: theme.spacing.xl },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
  },
  pressed: { opacity: 0.7 },
  cardBody: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: theme.colors.textPrimary },
  cardMeta: { fontSize: 13, color: theme.colors.textSecondary },
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: theme.radius.pill },
  pillPublished: { backgroundColor: theme.colors.surfaceSunken },
  pillDraft: { backgroundColor: theme.colors.warningSurface },
  pillText: { fontSize: 12, fontWeight: '600' },
  pillTextPublished: { color: theme.colors.success },
  pillTextDraft: { color: theme.colors.warning },
}));
