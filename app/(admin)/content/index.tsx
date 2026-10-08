import { useState } from 'react';
import { Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from 'convex/react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { DropdownMenu } from '@/components/ui/DropdownMenu';
import { TriageEditor } from '@/components/admin/TriageEditor';
import { TOPICS } from '@/constants/topics';
import { relativeTime } from '@/lib/format';
import { fonts } from '@/lib/fonts';

type Tab = 'articles' | 'triage';
type TopicFilter = 'all' | (typeof TOPICS)[number]['id'];
type StatusFilter = 'all' | 'published' | 'draft';

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: 'todos',
  published: 'publicados',
  draft: 'rascunhos',
};

// "Conteúdos": the admin writes and publishes the Explorar articles and edits
// the triage questions. The tab is in the address (?tab=triage) so a reload
// stays on it.
export default function AdminContent() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const router = useRouter();
  const tab: Tab = params.tab === 'triage' ? 'triage' : 'articles';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      {Platform.OS === 'web' && (
        <Text style={styles.title} accessibilityRole="header">
          Conteúdos
        </Text>
      )}

      <View style={styles.segment} accessibilityRole="tablist">
        {(['articles', 'triage'] as const).map((t) => (
          <Pressable
            key={t}
            testID={`content-tab-${t}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t }}
            aria-selected={tab === t}
            onPress={() => router.setParams({ tab: t === 'triage' ? 'triage' : undefined })}
            style={[styles.segmentItem, tab === t && styles.segmentItemOn]}
          >
            <Text style={[styles.segmentText, tab === t && styles.segmentTextOn]}>
              {t === 'articles' ? 'Artigos' : 'Triagem'}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'articles' ? <ArticlesPanel /> : <TriageEditor />}

    </ScrollView>
  );
}

function ArticlesPanel() {
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
    <View style={styles.panel}>
      <View style={styles.toolbar}>
        <Text style={styles.subtitle}>Só os artigos publicados aparecem no Explorar.</Text>
        <Button
          testID="content-new-article"
          size="sm"
          label="Novo artigo"
          onPress={() => router.push('/(admin)/content/new')}
        />
      </View>

      {/* Same search bar as Explorar. */}
      <View style={styles.searchBar}>
        <Icon name={{ sf: 'magnifyingglass', ion: 'search' }} size={16} color={theme.colors.textTertiary} />
        <TextInput
          testID="content-search"
          value={search}
          onChangeText={setSearch}
          placeholder="Pesquisar artigos..."
          placeholderTextColor={theme.colors.textTertiary as any}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

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

      {articles !== undefined && filtered.length === 0 && (
        <Text style={styles.empty}>Nenhum artigo encontrado.</Text>
      )}

      {filtered.map((item) => {
        const t = TOPICS.find((x) => x.id === item.topic);
        return (
          <Pressable
            key={item._id}
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
      })}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md, gap: theme.spacing.md, width: '100%', maxWidth: 860, alignSelf: 'flex-start' },
  title: { fontFamily: fonts.displayExtraBold, fontSize: 26, color: theme.colors.inkText },
  segment: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.surfaceSunken,
    borderRadius: theme.radius.pill,
    padding: 3,
  },
  segmentItem: { paddingHorizontal: theme.spacing.md, paddingVertical: 6, borderRadius: theme.radius.pill },
  segmentItemOn: { backgroundColor: theme.colors.surface },
  segmentText: { fontSize: 14, color: theme.colors.textSecondary },
  segmentTextOn: { color: theme.colors.inkText, fontWeight: '600' },
  panel: { gap: theme.spacing.sm },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.md },
  subtitle: { flex: 1, fontSize: 14, color: theme.colors.textSecondary },
  filters: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: theme.spacing.lg },
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
