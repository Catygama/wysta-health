import { Text, View } from 'react-native';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { ConversationList } from '@/screens/ConversationList';
import { Icon } from '@/components/ui/Icon';
import { colors, spacing, typography } from '@/constants/theme';

export default function PatientConversations() {
  const conversations = useQuery(api.conversations.listForPatient) ?? [];

  if (conversations.length === 0) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          gap: spacing.md,
          padding: spacing.lg,
        }}
      >
        <Icon
          name={{ sf: 'bubble.left.and.bubble.right.fill', ion: 'chatbubbles-outline' }}
          size={48}
          color={colors.text.tertiary}
        />
        <Text style={{ ...typography.lg, fontWeight: '600', color: colors.text.primary }}>
          Sem conversas ainda
        </Text>
        <Text style={{ ...typography.base, color: colors.text.secondary, textAlign: 'center' }}>
          Vai ao início e escolhe um tópico para começar.
        </Text>
      </View>
    );
  }

  return (
    <ConversationList
      conversations={conversations}
      basePath="/(patient)/conversations"
    />
  );
}
