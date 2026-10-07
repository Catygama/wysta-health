import { FlatList, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from 'convex/react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { api } from '@/convex/_generated/api';
import { ConversationFeedCard } from '@/screens/ConversationFeedCard';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { fonts } from '@/lib/fonts';

// "Conversas" tab: every open conversation (professional and AI). Closed ones
// live in Perfil → Histórico.
export default function PatientConversations() {
  const conversations = useQuery(api.conversations.listForPatient);
  const router = useRouter();
  const { theme } = useUnistyles();
  const open = (conversations ?? []).filter((c) => c.status !== 'closed');

  if (conversations !== undefined && open.length === 0) {
    return (
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
    );
  }

  return (
    <FlatList
      testID="conversations-list"
      data={open}
      keyExtractor={(item) => item._id}
      style={styles.list}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      renderItem={({ item }) => (
        <ConversationFeedCard
          conversation={item}
          onPress={() =>
            router.push({ pathname: '/(patient)/conversations/[id]', params: { id: item._id } })
          }
        />
      )}
    />
  );
}

const styles = StyleSheet.create((theme) => ({
  list: { flex: 1, backgroundColor: theme.colors.background },
  // Small top padding: the "Conversas" header already sits right above.
  content: { padding: theme.spacing.lg, paddingTop: theme.spacing.xs, gap: theme.spacing.sm },
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
