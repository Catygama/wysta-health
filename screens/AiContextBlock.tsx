import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useQuery } from 'convex/react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { api } from '@/convex/_generated/api';
import { Icon } from '@/components/ui/Icon';

// Professional side: the patient's chats with the AI assistant linked to this
// case, shown collapsed at the top of the chat. Read-only; the backend only
// returns them to the assigned professional (or anyone while unassigned).
export function AiContextBlock({ conversationId }: { conversationId: string }) {
  const chats = useQuery(api.conversations.aiContext, { id: conversationId as any });
  if (!chats || chats.length === 0) return null;
  return (
    <View style={styles.wrap}>
      {chats.map((chat) => (
        <AiChat key={chat.conversationId} chat={chat} />
      ))}
    </View>
  );
}

type Chat = {
  conversationId: string;
  relation: 'before' | 'during';
  messages: { _id: string; fromPatient: boolean; content: string }[];
};

function AiChat({ chat }: { chat: Chat }) {
  const { theme } = useUnistyles();
  const [open, setOpen] = useState(false);
  const count = chat.messages.length;
  const lead =
    chat.relation === 'before'
      ? 'Antes de pedir um enfermeiro, a utente falou com a assistente IA'
      : 'Enquanto esperava, a utente falou com a assistente IA';

  return (
    <View testID={`ai-context-${chat.conversationId}`} style={styles.block}>
      <Pressable
        testID="ai-context-toggle"
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        aria-expanded={open}
        onPress={() => setOpen((o) => !o)}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}
      >
        <Icon name={{ sf: 'sparkles', ion: 'sparkles-outline' }} size={16} color={theme.colors.inkText} />
        <Text style={styles.headerText}>
          {lead}{' '}
          <Text style={styles.count}>
            ({count} {count === 1 ? 'mensagem' : 'mensagens'})
          </Text>
        </Text>
        <Icon
          name={open ? { sf: 'chevron.up', ion: 'chevron-up' } : { sf: 'chevron.down', ion: 'chevron-down' }}
          size={16}
          color={theme.colors.inkText}
        />
      </Pressable>

      {open && (
        <View style={styles.messages}>
          <Text style={styles.readOnly}>Só leitura</Text>
          {chat.messages.map((m) => (
            <View key={m._id} style={[styles.bubble, m.fromPatient ? styles.patient : styles.ai]}>
              <Text style={styles.who}>{m.fromPatient ? 'Utente' : 'Assistente IA'}</Text>
              <Text style={styles.text}>{m.content}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  wrap: { gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
  block: {
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.surfaceSunken,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  pressed: { opacity: 0.7 },
  headerText: { flex: 1, fontSize: 14, color: theme.colors.textPrimary },
  count: { fontWeight: '600', color: theme.colors.inkText },
  messages: {
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  readOnly: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: theme.colors.textSecondary,
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    gap: 2,
  },
  patient: { alignSelf: 'flex-end', backgroundColor: theme.colors.surface },
  ai: { alignSelf: 'flex-start', backgroundColor: theme.topic.intimate.fill },
  who: { fontSize: 11, fontWeight: '600', color: theme.colors.textSecondary },
  text: { fontSize: 14, lineHeight: 20, color: theme.colors.textPrimary },
}));
