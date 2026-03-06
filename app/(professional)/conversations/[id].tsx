import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { MessageThread } from '@/screens/MessageThread';
import { colors, spacing, typography, radius } from '@/constants/theme';

export default function ProfessionalConversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useQuery(api.users.currentUser);
  const conversation = useQuery(api.conversations.get, id ? { id: id as any } : 'skip');
  const assign = useMutation(api.conversations.assign);
  const close = useMutation(api.conversations.close);

  if (!user || conversation === undefined || !id) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!conversation) return null;

  const canAssign = conversation.status === 'waiting';
  const canClose = conversation.status === 'active' || conversation.status === 'escalated';

  return (
    <View style={{ flex: 1 }}>
      {(canAssign || canClose) && (
        <View style={{ flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          {canAssign && (
            <Pressable
              onPress={() => assign({ id: id as any })}
              style={{ flex: 1, backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center' }}
            >
              <Text style={{ ...typography.sm, fontWeight: '600', color: '#fff' }}>
                Atribuir a mim
              </Text>
            </Pressable>
          )}
          {canClose && (
            <Pressable
              onPress={() => close({ id: id as any })}
              style={{ flex: 1, backgroundColor: colors.background.tertiary, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}
            >
              <Text style={{ ...typography.sm, fontWeight: '600', color: colors.text.secondary }}>
                Encerrar
              </Text>
            </Pressable>
          )}
        </View>
      )}
      <MessageThread
        conversationId={id}
        currentUserId={user._id}
        isProfessional
      />
    </View>
  );
}
