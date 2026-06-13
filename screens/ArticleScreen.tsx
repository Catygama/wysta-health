import { ScrollView, View, Text, ActivityIndicator } from 'react-native';
import { Stack, useLocalSearchParams, useRouter, useSegments } from 'expo-router';
import { useQuery } from 'convex/react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { api } from '@/convex/_generated/api';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { TOPICS } from '@/constants/topics';
import { fonts } from '@/lib/fonts';

export function ArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const article = useQuery(api.education.get, id ? { id: id as any } : 'skip');
  const router = useRouter();
  const segments = useSegments();
  const isPatient = segments[0] === '(patient)';
  const { theme } = useUnistyles();

  if (article === undefined) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={theme.colors.ink} />
      </View>
    );
  }

  if (!article) return null;

  const topic = TOPICS.find((t) => t.id === article.topic);
  const pastel = theme.topic[topic?.color ?? 'general'];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Stack.Screen options={{ title: topic?.label ?? 'Artigo' }} />
      <View style={styles.head}>
        {topic && (
          <View style={[styles.topicPill, { backgroundColor: pastel.fill }]}>
            <Icon name={topic.icon} size={14} color={pastel.on} />
            <Text style={[styles.topicPillText, { color: pastel.on }]}>{topic.label}</Text>
          </View>
        )}

        <Text style={styles.title}>{article.title}</Text>

        <View style={styles.metaRow}>
          <Icon name={{ sf: 'clock', ion: 'time-outline' }} size={14} color={theme.colors.textTertiary} />
          <Text style={styles.metaText}>{article.readingTimeMinutes} min de leitura</Text>
        </View>

        {article.summary && <Text style={styles.summary}>{article.summary}</Text>}
      </View>

      <Text style={styles.body}>{article.content}</Text>

      {article.whenToSeekHelp && (
        <View style={styles.callout}>
          <View style={styles.calloutHeader}>
            <Icon
              name={{ sf: 'exclamationmark.triangle.fill', ion: 'warning' }}
              size={20}
              color={theme.colors.danger}
            />
            <Text style={styles.calloutTitle}>Quando procurar ajuda</Text>
          </View>
          <Text style={styles.calloutBody}>{article.whenToSeekHelp}</Text>
        </View>
      )}

      {article.tags.length > 0 && (
        <View style={styles.tags}>
          {article.tags.map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>#{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {isPatient && (
        <View style={styles.ctaCard}>
          <Text style={styles.ctaTitle}>Precisas de apoio personalizado?</Text>
          <Text style={styles.ctaSub}>
            Fala com um profissional de saúde sobre{' '}
            {topic?.label.toLowerCase() ?? 'este tema'}.
          </Text>
          <Button
            testID="article-start-conversation"
            label="Iniciar conversa"
            onPress={() =>
              router.push({ pathname: '/triage', params: { topic: article.topic } })
            }
          />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background },
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, gap: theme.spacing.lg },
  head: { gap: theme.spacing.sm },
  topicPill: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.pill,
  },
  topicPillText: { fontSize: 12, fontWeight: '500' },
  title: { fontFamily: fonts.displayExtraBold, fontSize: 26, color: theme.colors.ink, lineHeight: 30 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
  metaText: { fontSize: 14, color: theme.colors.textSecondary },
  summary: { fontSize: 16, color: theme.colors.textSecondary, fontStyle: 'italic' },
  body: { fontSize: 16, color: theme.colors.textPrimary, lineHeight: 26 },
  callout: {
    backgroundColor: theme.colors.dangerLight,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  calloutHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  calloutTitle: { fontFamily: fonts.displayBold, fontSize: 18, color: theme.colors.danger },
  calloutBody: { fontSize: 16, color: theme.colors.textPrimary, lineHeight: 24 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs },
  tag: {
    backgroundColor: theme.colors.surfaceSunken,
    paddingVertical: 3,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.pill,
  },
  tagText: { fontSize: 12, color: theme.colors.textSecondary },
  ctaCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  ctaTitle: { fontFamily: fonts.displayBold, fontSize: 16, color: theme.colors.textPrimary },
  ctaSub: { fontSize: 14, color: theme.colors.textSecondary },
}));
