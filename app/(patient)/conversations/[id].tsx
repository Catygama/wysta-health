import { useLocalSearchParams } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { MessageThread } from '@/screens/MessageThread';

export default function PatientConversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useQuery(api.users.currentUser);

  if (!user || !id) return null;

  return (
    <MessageThread
      conversationId={id}
      currentUserId={user._id}
      isProfessional={false}
    />
  );
}
