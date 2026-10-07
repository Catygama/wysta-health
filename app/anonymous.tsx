import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Redirect, useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useAction } from 'convex/react';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { api } from '@/convex/_generated/api';
import { Icon } from '@/components/ui/Icon';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { fonts } from '@/lib/fonts';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { AiResponseMessage } from '@/screens/MessageThread';
import { pickImage, pickDocument, type PickedFile } from '@/lib/upload';

// Attachments stay on this device: shown in the chat, never uploaded, so the
// conversation remains unsaved. The assistant only reads text (as in the
// regular chat), so it's told a file was attached, not its contents.
type Attachment = { kind: 'image' | 'file'; file: PickedFile };
type Turn = { id: number; fromPatient: boolean; content: string; attachment?: Attachment };

const INPUT_MIN_HEIGHT = 44;
const INPUT_MAX_HEIGHT = 140;

// Anonymous chat with the AI: a normal-looking chat, but nothing is saved.
// Turns live only in this screen's state (sent back to the assistant as
// context) and are gone when the patient leaves, so leaving asks first.
// No "talk to a professional" or "end" actions here.
export default function AnonymousChat() {
  const { user, isLoading, role } = useCurrentUser();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { theme } = useUnistyles();
  const respond = useAction(api.ai.assistant.respondAnonymous);

  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState('');
  const [pending, setPending] = useState<Attachment | null>(null);
  const inputRef = useRef<TextInput>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const pendingLeave = useRef<null | (() => void)>(null);
  const listRef = useRef<FlatList<Turn>>(null);
  const nextId = useRef(1);

  const hasChat = turns.length > 0;

  // Back gestures, hardware back and in-app navigation: confirm first.
  usePreventRemove(hasChat, ({ data }) => {
    pendingLeave.current = () => navigation.dispatch(data.action);
    setConfirmLeave(true);
  });

  // Web: one-line field that grows with its text (same as the regular chat).
  useLayoutEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = inputRef.current as unknown as HTMLTextAreaElement | null;
    if (!el?.style) return;
    el.style.resize = 'none';
    el.style.height = 'auto';
    el.style.height = `${Math.min(Math.max(el.scrollHeight, INPUT_MIN_HEIGHT), INPUT_MAX_HEIGHT)}px`;
  }, [text]);

  // Web: closing or reloading the tab would also lose the chat.
  useEffect(() => {
    if (Platform.OS !== 'web' || !hasChat) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasChat]);

  if (isLoading) return null;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (role !== 'patient') return <Redirect href="/" />;

  function leave() {
    if (router.canGoBack()) router.back();
    else router.replace('/(patient)/');
  }

  async function attach(kind: Attachment['kind']) {
    setError(null);
    try {
      const file = kind === 'image' ? await pickImage() : await pickDocument();
      if (file) setPending({ kind, file });
    } catch (e: any) {
      setError(e?.message ?? 'Não foi possível abrir o ficheiro.');
    }
  }

  const describe = (a: Attachment) =>
    a.kind === 'image'
      ? '[A utente anexou uma imagem, que não consegues ver.]'
      : `[A utente anexou um documento${a.file.fileName ? ` ("${a.file.fileName}")` : ''}, que não consegues ler.]`;

  async function send() {
    const typed = text.trim();
    if ((!typed && !pending) || busy) return;
    setError(null);
    const attachment = pending ?? undefined;
    const mine: Turn = { id: nextId.current++, fromPatient: true, content: typed, attachment };
    const history = turns.map(({ fromPatient, content, attachment: a }) => ({
      fromPatient,
      content: [content, a ? describe(a) : ''].filter(Boolean).join(' '),
    }));
    setTurns((t) => [...t, mine]);
    setText('');
    setPending(null);
    // The assistant only reads text: nothing to answer for a file on its own.
    if (!typed) return;
    const query = attachment ? `${typed} ${describe(attachment)}` : typed;
    setBusy(true);
    try {
      const r = await respond({ query, history });
      setTurns((t) => [...t, { id: nextId.current++, fromPatient: false, content: r.answer }]);
    } catch {
      setError('Não foi possível obter resposta. Tenta outra vez.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={layout.flex} behavior="padding">
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable
            testID="anonymous-back"
            accessibilityRole="button"
            accessibilityLabel="Sair da conversa anónima"
            hitSlop={8}
            onPress={() => (hasChat ? setConfirmLeave(true) : leave())}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          >
            <Icon name={{ sf: 'chevron.left', ion: 'chevron-back' }} size={24} color={theme.colors.textPrimary} />
          </Pressable>
          <Icon name={{ sf: 'lock.fill', ion: 'lock-closed' }} size={16} color={theme.colors.inkText} />
          <Text style={styles.headerTitle} accessibilityRole="header">
            Conversa anónima
          </Text>
        </View>

        <FlatList
          ref={listRef}
          testID="anonymous-messages"
          data={turns}
          keyExtractor={(t) => String(t.id)}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => listRef.current?.scrollToEnd()}
          ListHeaderComponent={
            <View style={styles.notice}>
              <Text style={styles.noticeText}>
                Esta conversa não fica guardada nem é partilhada com um profissional. Quando
                saíres, é apagada. As respostas são apenas informativas; em caso de urgência
                liga 112 ou SNS 24 (808 24 24 24).
              </Text>
            </View>
          }
          renderItem={({ item }) =>
            item.fromPatient ? (
              <View style={styles.ownGroup}>
                {item.attachment && (
                  <ChatMessage
                    side="own"
                    messageType={item.attachment.kind}
                    content={item.attachment.file.fileName ?? (item.attachment.kind === 'image' ? 'Imagem partilhada' : 'Documento')}
                    imageUrl={item.attachment.kind === 'image' ? item.attachment.file.uri : null}
                    attachmentUrl={item.attachment.kind === 'file' ? item.attachment.file.uri : null}
                    attachmentName={item.attachment.file.fileName ?? 'Documento'}
                    attachmentSize={item.attachment.file.size}
                  />
                )}
                {item.content ? <ChatMessage side="own" content={item.content} messageType="text" /> : null}
              </View>
            ) : (
              <AiResponseMessage content={item.content} />
            )
          }
          ListFooterComponent={
            busy ? (
              <AiResponseMessage content="" streaming />
            ) : error ? (
              <Text style={styles.error}>{error}</Text>
            ) : null
          }
        />

        <View style={[styles.composer, { paddingBottom: theme.spacing.md + insets.bottom }]}>
          {pending && (
            <View style={styles.pendingRow}>
              {pending.kind === 'image' ? (
                <Image source={{ uri: pending.file.uri }} style={styles.pendingThumb} resizeMode="cover" />
              ) : (
                <View style={styles.pendingDoc}>
                  <Icon name={{ sf: 'doc', ion: 'document-outline' }} size={20} color={theme.colors.textSecondary} />
                </View>
              )}
              <Text style={styles.pendingName} numberOfLines={1}>
                {pending.file.fileName ?? (pending.kind === 'image' ? 'Imagem selecionada' : 'Documento selecionado')}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remover anexo"
                hitSlop={8}
                onPress={() => setPending(null)}
              >
                <Icon name={{ sf: 'xmark.circle.fill', ion: 'close-circle' }} size={22} color={theme.colors.textTertiary} />
              </Pressable>
            </View>
          )}
          <View style={styles.inputRow}>
            <Pressable
              testID="anonymous-attach-image"
              accessibilityRole="button"
              accessibilityLabel="Anexar imagem"
              onPress={() => attach('image')}
              disabled={busy}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
            >
              <Icon name={{ sf: 'photo', ion: 'image-outline' }} size={20} color={theme.colors.textSecondary} />
            </Pressable>
            <Pressable
              testID="anonymous-attach-document"
              accessibilityRole="button"
              accessibilityLabel="Anexar documento"
              onPress={() => attach('file')}
              disabled={busy}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
            >
              <Icon name={{ sf: 'paperclip', ion: 'attach' }} size={20} color={theme.colors.textSecondary} />
            </Pressable>
            <TextInput
              ref={inputRef}
              // @ts-expect-error web-only: one visible row instead of the textarea default of two
              rows={1}
              testID="anonymous-input"
              value={text}
              onChangeText={setText}
              placeholder="Escreve uma mensagem..."
              placeholderTextColor={theme.colors.textTertiary as any}
              multiline
              editable={!busy}
              style={styles.input}
            />
            <Pressable
              testID="anonymous-send"
              accessibilityRole="button"
              accessibilityLabel="Enviar"
              onPress={send}
              disabled={(!text.trim() && !pending) || busy}
              style={[styles.send, (text.trim() || pending) && !busy ? styles.sendOn : styles.sendOff]}
            >
              <Icon
                name={{ sf: 'arrow.up', ion: 'arrow-up' }}
                size={18}
                color={(text.trim() || pending) && !busy ? theme.colors.onInk : theme.colors.textTertiary}
              />
            </Pressable>
          </View>
        </View>
      </View>

      <ConfirmDialog
        testID="anonymous-leave-dialog"
        visible={confirmLeave}
        title="Sair da conversa anónima?"
        message="Depois de saíres, esta conversa é apagada e não vais conseguir voltar a vê-la."
        confirmLabel="Sair e apagar"
        onCancel={() => {
          pendingLeave.current = null;
          setConfirmLeave(false);
        }}
        onConfirm={() => {
          setConfirmLeave(false);
          const go = pendingLeave.current;
          pendingLeave.current = null;
          // Clear first so usePreventRemove lets the navigation through.
          setTurns([]);
          setTimeout(() => (go ? go() : leave()), 0);
        }}
      />
    </KeyboardAvoidingView>
  );
}

// Plain style: Unistyles styles are partly dropped on third-party wrappers on web.
const layout = { flex: { flex: 1 } } as const;

const styles = StyleSheet.create((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
  },
  back: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  headerTitle: { fontFamily: fonts.displayBold, fontSize: 20, color: theme.colors.textPrimary },
  list: { flex: 1 },
  listContent: { padding: theme.spacing.md, gap: theme.spacing.sm },
  notice: {
    backgroundColor: theme.colors.surfaceSunken,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    padding: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  noticeText: { fontSize: 13, lineHeight: 19, color: theme.colors.textSecondary },
  error: { fontSize: 13, color: theme.colors.danger },
  ownGroup: { gap: theme.spacing.xs },
  // Composer: same look as the regular chat (screens/MessageThread).
  composer: {
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
  },
  inputRow: { flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'flex-end' },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  iconBtnPressed: { backgroundColor: theme.colors.surfaceSunken },
  input: {
    flex: 1,
    minHeight: INPUT_MIN_HEIGHT,
    maxHeight: INPUT_MAX_HEIGHT,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surfaceSunken,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surface,
  },
  pendingThumb: { width: 40, height: 40, borderRadius: theme.radius.sm, backgroundColor: theme.colors.surfaceSunken },
  pendingDoc: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingName: { flex: 1, fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sendOn: { backgroundColor: theme.colors.ink },
  sendOff: { backgroundColor: theme.colors.surfaceSunken },
}));
