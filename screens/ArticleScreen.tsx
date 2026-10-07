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
        <ActivityIndicator color={theme.colors.inkText} />
      </View>
    );
  }

  if (!article) return null;

  const topic = TOPICS.find((t) => t.id === article.topic);

  const startConversation = () =>
    router.push({ pathname: '/triage', params: { topic: article.topic, mode: 'professional' } });

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Stack.Screen options={{ title: topic?.label ?? 'Artigo' }} />
      <View style={styles.head}>
        <Text style={styles.title}>{article.title}</Text>

        <Text style={styles.metaText}>
          {topic ? `${topic.label} · ` : ''}
          {article.readingTimeMinutes} min de leitura
        </Text>

        {article.summary && <Text style={styles.summary}>{article.summary}</Text>}
      </View>

      <View style={styles.bodyBlocks}>
        {parseBody(article.content).map((block, i) => {
          if (block.kind === 'heading') {
            return (
              <Text key={i} style={styles.subheading} accessibilityRole="header">
                {block.text}
              </Text>
            );
          }
          if (block.kind === 'list') {
            return (
              <View key={i} style={styles.list}>
                {block.items.map((item, j) => (
                  <View key={j} style={styles.helpItem}>
                    <View style={styles.bullet} />
                    <Text style={styles.listText}>{item}</Text>
                  </View>
                ))}
              </View>
            );
          }
          return (
            <Text key={i} style={styles.body}>
              {block.text}
            </Text>
          );
        })}
      </View>

      {article.whenToSeekHelp && (
        <View style={styles.callout}>
          <Text style={styles.calloutTitle}>Quando procurar ajuda</Text>
          {helpItems(article.whenToSeekHelp).map((item, i) => (
            <View key={i} style={styles.helpItem}>
              <View style={styles.bullet} />
              <Text style={styles.calloutBody}>{item}</Text>
            </View>
          ))}
          {isPatient && (
            <View style={styles.calloutAction}>
              <Button
                testID="article-start-conversation"
                label="Falar com um profissional"
                size="sm"
                onPress={startConversation}
              />
            </View>
          )}
        </View>
      )}

      {isPatient && !article.whenToSeekHelp && (
        <View style={styles.ctaCard}>
          <Text style={styles.ctaTitle}>Precisas de apoio personalizado?</Text>
          <Text style={styles.ctaSub}>
            Fala com um profissional de saúde sobre{' '}
            {topic?.label.toLowerCase() ?? 'este tema'}.
          </Text>
          <Button
            testID="article-start-conversation"
            label="Iniciar conversa"
            onPress={startConversation}
          />
        </View>
      )}
    </ScrollView>
  );
}

type BodyBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'heading'; text: string }
  | { kind: 'list'; items: string[] };

// Article content is plain text: paragraphs separated by blank lines, a line
// ending in ":" introduces a section ("Pontos-chave:"), "- " lines are bullets.
function parseBody(text: string): BodyBlock[] {
  const blocks: BodyBlock[] = [];
  for (const chunk of text.split(/\n\s*\n/)) {
    let paragraph: string[] = [];
    let items: string[] = [];
    const flush = () => {
      if (paragraph.length) blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
      if (items.length) blocks.push({ kind: 'list', items });
      paragraph = [];
      items = [];
    };
    for (const line of chunk.split('\n').map((l) => l.trim()).filter(Boolean)) {
      if (/^[-•]\s+/.test(line)) {
        if (paragraph.length) flush();
        items.push(line.replace(/^[-•]\s+/, ''));
      } else if (line.endsWith(':') && line.length < 60) {
        flush();
        blocks.push({ kind: 'heading', text: line.slice(0, -1) });
      } else {
        if (items.length) flush();
        paragraph.push(line);
      }
    }
    flush();
  }
  return blocks;
}

// "Procure ajuda se:\n- a\n- b" → ['a', 'b']: drops the lead-in line, since
// the section title already says it, and the dashes, drawn as bullets.
function helpItems(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.endsWith(':'))
    .map((l) => l.replace(/^[-•]\s*/, ''));
}

const styles = StyleSheet.create((theme) => ({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background },
  screen: { flex: 1, backgroundColor: theme.colors.background },
  // Readable line length on wide screens: one centred column.
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  head: { gap: theme.spacing.sm },
  title: { fontFamily: fonts.displayExtraBold, fontSize: 26, color: theme.colors.inkText, lineHeight: 30 },
  metaText: { fontSize: 14, color: theme.colors.textSecondary },
  // Lead paragraph: says what the article is about.
  summary: {
    fontFamily: fonts.display,
    fontSize: 19,
    lineHeight: 28,
    color: theme.colors.accent,
    marginTop: theme.spacing.xs,
  },
  bodyBlocks: { gap: theme.spacing.md },
  body: { fontSize: 16, color: theme.colors.textPrimary, lineHeight: 26 },
  subheading: { fontFamily: fonts.displayBold, fontSize: 18, color: theme.colors.inkText, marginTop: theme.spacing.xs },
  list: { gap: theme.spacing.sm },
  listText: { flex: 1, fontSize: 16, color: theme.colors.textPrimary, lineHeight: 26 },
  // Part of the article text, not a box: just a section with its own title.
  callout: { gap: theme.spacing.sm },
  calloutTitle: { fontFamily: fonts.displayBold, fontSize: 18, color: theme.colors.inkText },
  helpItem: { flexDirection: 'row', gap: theme.spacing.sm },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.ink, marginTop: 10 },
  calloutBody: { flex: 1, fontSize: 16, color: theme.colors.textPrimary, lineHeight: 24 },
  calloutAction: { alignItems: 'flex-start', marginTop: theme.spacing.xs },
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
