import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { readingTimeFor } from '@/convex/lib/readingTime';
import type { TopicId } from '@/convex/lib/topics';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { DropdownMenu } from '@/components/ui/DropdownMenu';
import { ArticleView } from '@/screens/ArticleScreen';
import { TOPICS } from '@/constants/topics';
import { fonts } from '@/lib/fonts';
import { errorText } from '@/lib/errorText';

type Draft = {
  title: string;
  topic: TopicId;
  summary: string;
  content: string;
  whenToSeekHelp: string;
};

const EMPTY: Draft = { title: '', topic: TOPICS[0].id as TopicId, summary: '', content: '', whenToSeekHelp: '' };

// Admin editor for one Explorar article ("new" creates one). Drafts are only
// visible here; publishing shows the article to patients and professionals.
export default function AdminArticleEditor() {
  // `saved`: set when a new article was just saved, to keep the confirmation
  // after the address changes from /content/new to the article's id.
  const { id, saved } = useLocalSearchParams<{ id: string; saved?: string }>();
  const isNew = id === 'new';
  const articleId = isNew ? null : (id as Id<'educationalContent'>);
  const article = useQuery(api.education.get, articleId ? { id: articleId } : 'skip');
  const save = useMutation(api.education.save);
  const router = useRouter();
  const { theme } = useUnistyles();

  const [draft, setDraft] = useState<Draft | null>(isNew ? EMPTY : null);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [busy, setBusy] = useState<'draft' | 'publish' | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(
    saved === 'publish'
      ? { kind: 'ok', text: 'Artigo publicado. Já aparece no Explorar.' }
      : saved === 'draft'
        ? { kind: 'ok', text: 'Rascunho guardado.' }
        : null
  );

  // Fill the form once the article loads.
  useEffect(() => {
    if (article && draft === null) {
      setDraft({
        title: article.title,
        topic: article.topic as TopicId,
        summary: article.summary,
        content: article.content,
        whenToSeekHelp: article.whenToSeekHelp ?? '',
      });
    }
  }, [article, draft]);

  const goToList = () =>
    router.canGoBack() ? router.back() : router.replace('/(admin)/content');

  if (!isNew && article === undefined) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={theme.colors.inkText} />
      </View>
    );
  }
  if (!isNew && article === null) {
    return (
      <View style={styles.loading}>
        <Text style={styles.hint}>Artigo não encontrado.</Text>
      </View>
    );
  }
  if (!draft) return null;

  const published = !isNew && !!article?.isPublished;
  const set = (patch: Partial<Draft>) => {
    setDraft({ ...draft, ...patch });
    setMessage(null);
  };
  const readingTime = readingTimeFor(draft.summary, draft.content, draft.whenToSeekHelp);
  const topicLabel = TOPICS.find((t) => t.id === draft.topic)?.label ?? draft.topic;

  async function submit(publish: boolean) {
    if (!draft) return;
    setBusy(publish ? 'publish' : 'draft');
    setMessage(null);
    try {
      const savedId = await save({
        id: articleId ?? undefined,
        title: draft.title,
        topic: draft.topic,
        summary: draft.summary,
        content: draft.content,
        whenToSeekHelp: draft.whenToSeekHelp || undefined,
        publish,
      });
      setMessage({
        kind: 'ok',
        text: publish
          ? published
            ? 'Alterações publicadas.'
            : 'Artigo publicado. Já aparece no Explorar.'
          : published
            ? 'Artigo despublicado. Deixou de aparecer no Explorar.'
            : 'Rascunho guardado.',
      });
      if (isNew) {
        router.replace({
          pathname: '/(admin)/content/[id]',
          params: { id: savedId, saved: publish ? 'publish' : 'draft' },
        });
      }
    } catch (e: any) {
      setMessage({ kind: 'error', text: cleanError(e) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      {/* On web there is no stack header: our own way back to the list. */}
      {Platform.OS === 'web' && (
        <Pressable
          testID="content-back"
          accessibilityRole="button"
          accessibilityLabel="Voltar aos Conteúdos"
          hitSlop={8}
          onPress={goToList}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <Icon name={{ sf: 'chevron.left', ion: 'chevron-back' }} size={20} color={theme.colors.textPrimary} />
          <Text style={styles.backText}>Conteúdos</Text>
        </Pressable>
      )}

      <View style={styles.headRow}>
        <Text style={styles.heading} accessibilityRole="header">
          {isNew ? 'Novo artigo' : 'Editar artigo'}
        </Text>
        <View style={[styles.pill, published ? styles.pillPublished : styles.pillDraft]}>
          <Text style={[styles.pillText, published ? styles.pillTextPublished : styles.pillTextDraft]}>
            {published ? 'Publicado' : 'Rascunho'}
          </Text>
        </View>
      </View>

      <View style={styles.segment} accessibilityRole="tablist">
        {(['edit', 'preview'] as const).map((m) => (
          <Pressable
            key={m}
            testID={`content-mode-${m}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === m }}
            onPress={() => setMode(m)}
            style={[styles.segmentItem, mode === m && styles.segmentItemOn]}
          >
            <Text style={[styles.segmentText, mode === m && styles.segmentTextOn]}>
              {m === 'edit' ? 'Editar' : 'Pré-visualizar'}
            </Text>
          </Pressable>
        ))}
      </View>

      {mode === 'edit' ? (
        <View style={styles.form}>
          <Input
            testID="content-title"
            label="Título"
            value={draft.title}
            onChangeText={(title) => set({ title })}
            placeholder="ex.: Sinais de alerta na gravidez"
          />
          <View style={styles.row}>
            <View style={styles.field}>
              <Text style={styles.label}>Tema</Text>
              <DropdownMenu
                testID="content-topic"
                label={topicLabel}
                value={draft.topic}
                onChange={(topic) => set({ topic })}
                options={TOPICS.map((t) => ({ value: t.id as TopicId, label: t.label }))}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Tempo de leitura</Text>
              <Text style={styles.value}>{readingTime} min (automático)</Text>
            </View>
          </View>
          <Input
            testID="content-summary"
            label="Resumo (aparece no cartão e no início do artigo)"
            value={draft.summary}
            onChangeText={(summary) => set({ summary })}
            multiline
            minHeight={72}
          />
          <Input
            testID="content-body"
            label="Texto"
            value={draft.content}
            onChangeText={(content) => set({ content })}
            multiline
            minHeight={260}
          />
          <Text style={styles.hint}>
            Parágrafos separados por uma linha em branco. Uma linha a terminar em ":" é um subtítulo
            (ex.: "Pontos-chave:"). Linhas a começar por "- " são uma lista.
          </Text>
          <Input
            testID="content-help"
            label="Quando procurar ajuda (opcional)"
            value={draft.whenToSeekHelp}
            onChangeText={(whenToSeekHelp) => set({ whenToSeekHelp })}
            multiline
            minHeight={96}
          />
          <Text style={styles.hint}>Um ponto por linha, a começar por "- ".</Text>
        </View>
      ) : (
        <View testID="content-preview" style={styles.preview}>
          {draft.title.trim() || draft.content.trim() ? (
            <ArticleView
              article={{
                title: draft.title,
                topic: draft.topic,
                summary: draft.summary,
                content: draft.content,
                whenToSeekHelp: draft.whenToSeekHelp || undefined,
                readingTimeMinutes: readingTime,
              }}
            />
          ) : (
            <Text style={styles.hint}>Escreve o título e o texto para ver a pré-visualização.</Text>
          )}
        </View>
      )}

      {message && (
        <Text
          testID="content-message"
          accessibilityLiveRegion="polite"
          style={[styles.message, message.kind === 'error' && styles.messageError]}
        >
          {message.text}
        </Text>
      )}

      <View style={styles.actions}>
        {published ? (
          <>
            <Button
              testID="content-publish"
              label="Guardar e publicar"
              onPress={() => submit(true)}
              loading={busy === 'publish'}
              disabled={busy !== null}
            />
            <Button
              testID="content-unpublish"
              kind="secondary"
              label="Despublicar"
              onPress={() => submit(false)}
              loading={busy === 'draft'}
              disabled={busy !== null}
            />
          </>
        ) : (
          <>
            <Button
              testID="content-publish"
              label="Publicar"
              onPress={() => submit(true)}
              loading={busy === 'publish'}
              disabled={busy !== null}
            />
            <Button
              testID="content-save-draft"
              kind="secondary"
              label="Guardar rascunho"
              onPress={() => submit(false)}
              loading={busy === 'draft'}
              disabled={busy !== null}
            />
          </>
        )}
      </View>
    </ScrollView>
  );
}

// The server's message for the person (ConvexError), else a generic one.
function cleanError(e: unknown): string {
  return errorText(e, 'Não foi possível guardar o artigo.');
}

const styles = StyleSheet.create((theme) => ({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background },
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    padding: theme.spacing.md,
    gap: theme.spacing.md,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'flex-start',
  },
  back: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: theme.spacing.xs, minHeight: 44, marginLeft: -4 },
  pressed: { opacity: 0.6 },
  backText: { fontFamily: fonts.displayBold, fontSize: 17, color: theme.colors.textPrimary },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, flexWrap: 'wrap' },
  heading: { fontFamily: fonts.displayExtraBold, fontSize: 24, color: theme.colors.inkText },
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: theme.radius.pill },
  pillPublished: { backgroundColor: theme.colors.surfaceSunken },
  pillDraft: { backgroundColor: theme.colors.warningSurface },
  pillText: { fontSize: 12, fontWeight: '600' },
  pillTextPublished: { color: theme.colors.success },
  pillTextDraft: { color: theme.colors.warning },
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
  form: { gap: theme.spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.lg },
  field: { gap: theme.spacing.xs },
  label: { fontSize: 14, fontWeight: '500', color: theme.colors.textSecondary },
  value: { fontSize: 15, color: theme.colors.textPrimary, paddingVertical: theme.spacing.xs },
  hint: { fontSize: 13, color: theme.colors.textSecondary, marginTop: -theme.spacing.xs },
  preview: {
    gap: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
  },
  message: { fontSize: 14, color: theme.colors.success },
  messageError: { color: theme.colors.danger },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
}));
