import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from 'convex/react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { api } from '@/convex/_generated/api';
import { TOPIC_CHOICES, OTHER_TOPIC, type TopicColor } from '@/constants/topics';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Card } from '@/components/ui/Card';
import { fonts } from '@/lib/fonts';
import type { ConversationMode } from '@/constants/conversation';

function TopicIcon({ color, icon, size = 44 }: { color: TopicColor; icon: IconName; size?: number }) {
  const { theme } = useUnistyles();
  const pastel = theme.topic[color];
  return (
    <View
      style={[
        styles.topicIcon,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: pastel.fill },
      ]}
    >
      <Icon name={icon} size={size * 0.5} color={pastel.on} />
    </View>
  );
}

export default function PatientHome() {
  const router = useRouter();
  const { theme } = useUnistyles();
  const user = useQuery(api.users.currentUser);
  const greeting =
    user?.profile?.displayName?.trim().split(/\s+/)[0] || user?.email?.split('@')[0] || 'utente';
  // Which path the patient chose on Home; the topic picker is open while set.
  const [pickerMode, setPickerMode] = useState<ConversationMode | null>(null);
  const openByTopic = useQuery(api.conversations.openProfessionalByTopic) ?? {};
  const openAiByTopic = useQuery(api.conversations.openAiByTopic) ?? {};
  const openForMode = (mode: ConversationMode | null) => (mode === 'ai' ? openAiByTopic : openByTopic);

  function startTopic(topicId: string) {
    const mode = pickerMode ?? 'professional';
    setPickerMode(null);
    // One open conversation per topic with a nurse and one with the AI: go back to it.
    const openId = openForMode(mode)[topicId];
    if (openId) {
      router.push({ pathname: '/(patient)/conversations/[id]', params: { id: openId } });
      return;
    }
    if (topicId === 'sexual-wellbeing') {
      router.push({ pathname: '/wellbeing', params: { mode } });
      return;
    }
    router.push({ pathname: '/triage', params: { topic: topicId, mode } });
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      <View style={styles.hero}>
        <Text style={styles.greeting}>Olá, {greeting}</Text>
        <Text style={styles.subtitle}>Sobre o que precisas de ajuda hoje?</Text>
      </View>

      <View style={styles.section}>
        <PathCard
          testID="home-path-professional"
          icon={{ sf: 'stethoscope', ion: 'medkit-outline' }}
          iconFill={theme.colors.butter}
          title="Enfermeiro/a"
          description="Responde a umas perguntas e um enfermeiro responde-te por mensagem"
          onPress={() => setPickerMode('professional')}
        />
        <PathCard
          testID="home-path-ai"
          icon={{ sf: 'sparkles', ion: 'sparkles-outline' }}
          iconFill={theme.topic.intimate.fill}
          title="Assistente IA"
          description="Responde a umas perguntas e recebe resposta imediata. Podes pedir um enfermeiro a qualquer momento"
          onPress={() => setPickerMode('ai')}
        />
        <AnonymousAiButton />
      </View>

      <TopicPickerSheet
        visible={pickerMode !== null}
        mode={pickerMode ?? 'professional'}
        openTopics={pickerMode ? openForMode(pickerMode) : {}}
        onClose={() => setPickerMode(null)}
        onSelect={startTopic}
      />
    </ScrollView>
  );
}

function TopicPickerSheet({
  visible,
  mode,
  openTopics,
  onClose,
  onSelect,
}: {
  visible: boolean;
  mode: ConversationMode;
  /** Topics with an open conversation of this mode (shown as "em curso"). */
  openTopics: Record<string, string>;
  onClose: () => void;
  onSelect: (topicId: string) => void;
}) {
  const { theme } = useUnistyles();
  // Wide screens: two columns, so all topics fit without scrolling.
  const twoColumns = useWindowDimensions().width >= 640;
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>
              {mode === 'ai' ? 'Falar com a assistente IA' : 'Falar com enfermeiro'}
            </Text>
            <Pressable
              testID="topic-picker-close"
              accessibilityRole="button"
              accessibilityLabel="Fechar"
              onPress={onClose}
              hitSlop={8}
            >
              <Icon name={{ sf: 'xmark', ion: 'close' }} size={22} color={theme.colors.textSecondary} />
            </Pressable>
          </View>
          <Text style={styles.sheetNote}>
            {mode === 'ai'
              ? 'Escolhe o tema. Depois de umas perguntas, a assistente responde-te na hora.'
              : 'Escolhe o tema. Depois de umas perguntas, um enfermeiro responde-te por mensagem.'}
          </Text>
          <View style={[styles.topicList, twoColumns && styles.topicGrid]}>
            {/* The five topics, then the catch-all "general" as "Outro assunto". */}
            {[...TOPIC_CHOICES, OTHER_TOPIC].map((t) => (
              <Card
                key={t.id}
                testID={`topic-picker-${t.id}`}
                onPress={() => onSelect(t.id)}
                tone="sunken"
                style={[styles.topicCard, twoColumns && styles.topicCardHalf]}
              >
                <TopicIcon color={t.color} icon={t.icon} size={36} />
                <View style={styles.topicMeta}>
                  <Text style={styles.topicLabel}>
                    {t.id === OTHER_TOPIC.id ? 'Outro assunto' : t.label}
                  </Text>
                  <Text style={styles.topicDesc}>
                    {openTopics[t.id] ? 'Já tens uma conversa em curso. Toca para continuar.' : t.description}
                  </Text>
                </View>
                <Icon
                  name={{ sf: 'chevron.right', ion: 'chevron-forward' }}
                  size={18}
                  color={styles.chevron.color}
                />
              </Card>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Opens the anonymous chat (app/anonymous.tsx): nothing is saved there.
function AnonymousAiButton() {
  const { theme } = useUnistyles();
  const router = useRouter();
  return (
    <Card
      testID="anonymous-ai-open"
      onPress={() => router.push('/anonymous')}
      tone="sunken"
      style={styles.aiCard}
    >
      <View style={[styles.aiAvatar, styles.anonAvatar]}>
        <Icon name={{ sf: 'lock', ion: 'lock-closed-outline' }} size={18} color={theme.colors.inkText} />
      </View>
      <View style={styles.aiMeta}>
        <Text style={styles.aiTitle}>Pergunta anónima</Text>
        <Text style={styles.aiSub}>Conversa com a IA que não fica guardada</Text>
      </View>
      <Icon name={{ sf: 'chevron.right', ion: 'chevron-forward' }} size={18} color={styles.chevron.color} />
    </Card>
  );
}

// Home entry for one of the two conversation paths (professional / AI).
function PathCard({
  testID,
  icon,
  iconFill,
  title,
  description,
  onPress,
}: {
  testID: string;
  icon: IconName;
  iconFill: string;
  title: string;
  description: string;
  onPress: () => void;
}) {
  const { theme } = useUnistyles();
  return (
    <Card testID={testID} onPress={onPress} style={styles.pathCard}>
      <View style={styles.pathBody}>
        <View style={[styles.pathIcon, { backgroundColor: iconFill }]}>
          <Icon name={icon} size={20} color={theme.colors.inkText} />
        </View>
        <Text style={styles.pathTitle}>{title}</Text>
        <Text style={styles.pathDesc}>{description}</Text>
      </View>
      <Icon name={{ sf: 'chevron.right', ion: 'chevron-forward' }} size={18} color={styles.chevron.color} />
    </Card>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, gap: theme.spacing.lg },
  hero: { gap: theme.spacing.xs },
  greeting: { fontFamily: fonts.displayExtraBold, fontSize: 28, color: theme.colors.inkText },
  subtitle: { fontSize: 16, color: theme.colors.textSecondary },
  section: { gap: theme.spacing.md },
  // Topic picker / topic cards
  topicList: { gap: theme.spacing.sm },
  topicGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  topicCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  // Two per row (basis below 50% leaves room for the gap; grow fills it).
  topicCardHalf: { flexGrow: 1, flexBasis: '45%' },
  topicIcon: { alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' },
  topicMeta: { flex: 1, gap: 2 },
  topicLabel: { fontSize: 16, fontWeight: '500', color: theme.colors.textPrimary },
  topicDesc: { fontSize: 13, color: theme.colors.textSecondary },
  chevron: { color: theme.colors.textTertiary },
  // AI cards
  aiCard: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  aiAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.butter,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anonAvatar: { backgroundColor: theme.colors.surface },
  // Home path cards
  pathCard: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, padding: theme.spacing.md },
  pathBody: { flex: 1, gap: theme.spacing.xs },
  pathIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xs,
  },
  pathTitle: { fontSize: 16, fontWeight: '500', color: theme.colors.textPrimary },
  pathDesc: { fontSize: 13, lineHeight: 19, color: theme.colors.textSecondary },
  aiMeta: { flex: 1, gap: 2 },
  aiTitle: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  aiSub: { fontSize: 12, color: theme.colors.textSecondary },
  // Sheets
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    borderCurve: 'continuous',
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    maxHeight: '85%',
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle: { fontFamily: fonts.displayBold, fontSize: 18, color: theme.colors.textPrimary },
  sheetNote: { fontSize: 12, color: theme.colors.textSecondary, lineHeight: 18 },
}));
