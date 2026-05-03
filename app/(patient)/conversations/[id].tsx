import { useCallback } from 'react';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { MessageThread } from '@/screens/MessageThread';
import { useTabBar } from '@/contexts/TabBarContext';
import { TOPICS } from '@/constants/topics';

export default function PatientConversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useQuery(api.users.currentUser);
  const conversation = useQuery(
    api.conversations.get,
    id ? { id: id as any } : 'skip'
  );
  const { setIsTabBarHidden } = useTabBar();

  useFocusEffect(
    useCallback(() => {
      setIsTabBarHidden(true);
      return () => setIsTabBarHidden(false);
    }, [setIsTabBarHidden])
  );

  if (!user || !id) return null;
  const topic = conversation
    ? TOPICS.find((t) => t.id === conversation.topic)
    : undefined;

  return (
    <>
      <Stack.Screen options={{ title: topic?.label ?? 'Conversa' }} />
      <MessageThread
        conversationId={id}
        currentUserId={user._id}
        isProfessional={false}
      />
    </>
  );
}
