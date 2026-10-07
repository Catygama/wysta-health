import { useCallback, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Platform, useWindowDimensions } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation } from 'convex/react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { api } from '@/convex/_generated/api';
import { Icon } from '@/components/ui/Icon';
import { MessageThread } from '@/screens/MessageThread';
import { useTabBar } from '@/contexts/TabBarContext';
import { TOPICS } from '@/constants/topics';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

export default function PatientConversation() {
  const { id, waiting } = useLocalSearchParams<{ id: string; waiting?: string }>();
  const router = useRouter();
  const user = useQuery(api.users.currentUser);
  const conversation = useQuery(api.conversations.get, id ? { id: id as any } : 'skip');
  const switchMode = useMutation(api.conversations.switchMode);
  const closeConversation = useMutation(api.conversations.close);
  const { setIsTabBarHidden } = useTabBar();

  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setIsTabBarHidden(true);
      return () => setIsTabBarHidden(false);
    }, [setIsTabBarHidden])
  );

  if (!user || !id) return null;
  const topic = conversation ? TOPICS.find((t) => t.id === conversation.topic) : undefined;
  const closed = conversation?.status === 'closed';
  const isAiOnly = conversation?.kind === 'ai-only';

  // Professional ↔ AI toggle. The backend returns the open counterpart
  // conversation or creates a new one carrying this one as context.
  async function onSwitch() {
    setSwitchError(null);
    setSwitching(true);
    try {
      const target = await switchMode({ id: id as any });
      router.replace({
        pathname: '/(patient)/conversations/[id]',
        // Returning to an existing professional conversation: remind the
        // patient a reply is still pending there.
        params: isAiOnly && !target.created ? { id: target.id, waiting: '1' } : { id: target.id },
      });
    } catch (e: any) {
      setSwitchError(e?.message ?? 'Não foi possível mudar de conversa.');
    } finally {
      setSwitching(false);
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: topic?.label ?? 'Conversa',
          ...WEB_HEADER_FIT,
          headerRight:
            conversation && !closed
              ? () => (
                  <View style={styles.headerActions}>
                    <SwitchButton toAi={!isAiOnly} busy={switching} onPress={onSwitch} />
                    <EndButton onPress={() => setConfirmEnd(true)} />
                  </View>
                )
              : undefined,
        }}
      />
      {isAiOnly && !closed && <AiOnlyBanner />}
      {!isAiOnly && !closed && waiting === '1' && <WaitingBanner />}
      {switchError && <ErrorBanner text={switchError} onDismiss={() => setSwitchError(null)} />}
      <MessageThread
        conversationId={id}
        currentUserId={user._id}
        isProfessional={false}
        closed={closed}
        aiOnly={isAiOnly}
        onRequestEnd={() => setConfirmEnd(true)}
      />
      <ConfirmDialog
        testID="end-conversation-dialog"
        visible={confirmEnd}
        title="Tens a certeza que queres terminar a conversa?"
        message="A conversa passa para o Histórico, no teu Perfil, e já não poderás enviar mensagens nela."
        confirmLabel="Terminar"
        onCancel={() => setConfirmEnd(false)}
        onConfirm={async () => {
          await closeConversation({ id: id as any });
          setConfirmEnd(false);
        }}
      />
    </>
  );
}

// Web header (react-navigation's JS header): the title keeps its full width and
// the actions get what's left, so on a phone they spilled over the title and
// off the right edge. Let the title shrink (it ellipsizes) and keep the actions
// at their natural size. Native headers lay this out themselves.
// Below this width the header buttons use short labels (larger phones in
// landscape and tablets get the full ones).
const COMPACT_HEADER_WIDTH = 480;

const WEB_HEADER_FIT =
  Platform.OS === 'web'
    ? ({
        headerTitleContainerStyle: { flexShrink: 1 },
        headerRightContainerStyle: { flexGrow: 1, flexShrink: 0, flexBasis: 'auto' },
      } as object)
    : {};

function SwitchButton({
  toAi,
  busy,
  onPress,
}: {
  toAi: boolean;
  busy: boolean;
  onPress: () => void;
}) {
  const { theme } = useUnistyles();
  // Narrow phones: short label, so the topic title keeps its room.
  const compact = useWindowDimensions().width < COMPACT_HEADER_WIDTH;
  const label = toAi ? 'Conversar com IA' : 'Falar com profissional';
  return (
    <Pressable
      testID={toAi ? 'conversation-switch-to-ai' : 'conversation-switch-to-professional'}
      onPress={onPress}
      disabled={busy}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.cta, (pressed || busy) && styles.ctaBusy]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={theme.colors.onInk} />
      ) : (
        <Icon
          name={toAi ? { sf: 'sparkles', ion: 'sparkles' } : { sf: 'stethoscope', ion: 'medkit-outline' }}
          size={14}
          color={theme.colors.onInk}
        />
      )}
      <Text style={styles.ctaText}>{compact ? (toAi ? 'IA' : 'Profissional') : label}</Text>
    </Pressable>
  );
}

function EndButton({ onPress }: { onPress: () => void }) {
  const { theme } = useUnistyles();
  // Narrow phones: icon only, so the topic title keeps its room.
  const compact = useWindowDimensions().width < COMPACT_HEADER_WIDTH;
  return (
    <Pressable
      testID="conversation-end-button"
      onPress={onPress}
      hitSlop={8}
      accessibilityLabel="Terminar conversa"
      style={({ pressed }) => [styles.endBtn, pressed && styles.ctaBusy]}
    >
      <Icon
        name={{ sf: 'xmark.circle', ion: 'close-circle-outline' }}
        size={compact ? 18 : 14}
        color={theme.colors.inkText}
      />
      {!compact && <Text style={styles.endText}>Terminar</Text>}
    </Pressable>
  );
}

function AiOnlyBanner() {
  const { theme } = useUnistyles();
  return (
    <View style={styles.banner}>
      <View style={styles.avatar}>
        <Icon
          name={{ sf: 'bubble.left.and.bubble.right', ion: 'chatbubbles-outline' }}
          size={17}
          color={theme.colors.inkText}
        />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>Conversa com a assistente AI</Text>
        <Text style={styles.sub}>
          Cada mensagem tua recebe resposta automática. Um profissional de saúde pode ou não
          ver esta conversa.
        </Text>
      </View>
    </View>
  );
}

function WaitingBanner() {
  const { theme } = useUnistyles();
  return (
    <View testID="waiting-professional-banner" style={[styles.banner, styles.waitingBanner]}>
      <Icon name={{ sf: 'clock', ion: 'time-outline' }} size={18} color={theme.colors.inkText} />
      <View style={styles.body}>
        <Text style={styles.title}>A aguardar resposta do profissional</Text>
        <Text style={styles.sub}>Vais receber uma notificação quando responder.</Text>
      </View>
    </View>
  );
}

function ErrorBanner({ text, onDismiss }: { text: string; onDismiss: () => void }) {
  const { theme } = useUnistyles();
  return (
    <Pressable style={[styles.banner, styles.errorBanner]} onPress={onDismiss}>
      <Icon
        name={{ sf: 'exclamationmark.triangle', ion: 'warning-outline' }}
        size={16}
        color={theme.colors.danger}
      />
      <Text style={styles.errorText}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  banner: {
    // Same side inset as the message list, so the banner lines up with the cards.
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  waitingBanner: { backgroundColor: theme.colors.surfaceSunken },
  errorBanner: { backgroundColor: theme.colors.dangerLight },
  errorText: { flex: 1, fontSize: 13, color: theme.colors.danger },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.topic.intimate.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 13, fontWeight: '500', color: theme.colors.inkText },
  sub: { fontSize: 12, color: theme.colors.textSecondary },
  cta: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ctaBusy: { opacity: 0.7 },
  ctaText: { fontSize: 12, fontWeight: '500', color: theme.colors.onInk },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginRight: theme.spacing.sm,
    // Keeps the buttons off long titles like "Bem-estar sexual".
    marginLeft: theme.spacing.md,
  },
  endBtn: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.divider,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  endText: { fontSize: 12, fontWeight: '500', color: theme.colors.inkText },
}));
