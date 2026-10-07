import { useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { api } from '@/convex/_generated/api';
import { ConversationFeedCard } from '@/screens/ConversationFeedCard';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { TabTitle } from '@/components/ui/TabTitle';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { fonts } from '@/lib/fonts';

// "Conversas" tab: every open conversation (professional and AI). Closed ones
// live in Perfil → Histórico.
export default function PatientConversations() {
  const conversations = useQuery(api.conversations.listForPatient);
  const close = useMutation(api.conversations.close);
  const [toEnd, setToEnd] = useState<string | null>(null);
  const router = useRouter();
  const { theme } = useUnistyles();
  const open = (conversations ?? []).filter((c) => c.status !== 'closed');

  // Same title as the professional's; the arrow goes to Início, the patient's
  // main screen.
  const header = <TabTitle title="Conversas" home="/(patient)/" />;

  if (conversations !== undefined && open.length === 0) {
    return (
      <View style={styles.list}>
        {header}
        <View testID="conversations-empty" style={styles.empty}>
          <View style={styles.iconChip}>
            <Icon
              name={{
                sf: 'bubble.left.and.bubble.right.fill',
                ion: 'chatbubbles-outline',
              }}
              size={34}
              color={theme.topic.intimate.on}
            />
          </View>
          <Text style={styles.title}>Sem conversas abertas</Text>
          <Text style={styles.body}>
            Escolhe um tópico no Início para falares com um profissional de saúde ou com a
            assistente AI.
          </Text>
          <View style={styles.cta}>
            <Button label="Iniciar conversa" onPress={() => router.push('/(patient)/')} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {header}
      <FlatList
        testID="conversations-list"
        data={open}
        keyExtractor={(item) => item._id}
        style={styles.list}
        contentContainerStyle={[
          styles.content,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.divider },
        ]}
        contentInsetAdjustmentBehavior="automatic"
        renderItem={({ item, index }) => (
          <ConversationFeedCard
            conversation={item}
            isLast={index === open.length - 1}
            onPress={() =>
              router.push({ pathname: '/(patient)/conversations/[id]', params: { id: item._id } })
            }
            onEnd={() => setToEnd(item._id)}
          />
        )}
      />
      <ConfirmDialog
        testID="end-conversation-dialog"
        visible={toEnd !== null}
        title="Tens a certeza que queres terminar a conversa?"
        message="A conversa passa para o Histórico no teu Perfil e deixas de poder enviar mensagens nela."
        confirmLabel="Terminar"
        onCancel={() => setToEnd(null)}
        onConfirm={async () => {
          if (toEnd) await close({ id: toEnd as any });
          setToEnd(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  list: { flex: 1, backgroundColor: theme.colors.background },
  // White group so the rows stand out from the page background; rows carry
  // their own dividers. Same side inset as the professional's list.
  content: {
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: theme.colors.divider,
    overflow: 'hidden',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  iconChip: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderCurve: 'continuous',
    backgroundColor: theme.topic.intimate.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 18,
    color: theme.colors.textPrimary,
  },
  body: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    maxWidth: 320,
  },
  cta: { width: '100%', maxWidth: 320 },
}));
