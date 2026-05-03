import { useCallback } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { MessageThread } from '@/screens/MessageThread';
import { useTabBar } from '@/contexts/TabBarContext';

export default function PatientConversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useQuery(api.users.currentUser);
  const { setIsTabBarHidden } = useTabBar();

  useFocusEffect(
    useCallback(() => {
      setIsTabBarHidden(true);
      return () => setIsTabBarHidden(false);
    }, [setIsTabBarHidden]),
  );

  if (!user || !id) return null;

  return (
    <MessageThread
      conversationId={id}
      currentUserId={user._id}
      isProfessional={false}
    />
  );
}
