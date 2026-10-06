import { ConversationHistory } from '@/screens/ConversationHistory';

export default function PatientHistory() {
  return <ConversationHistory detailPath="/(patient)/profile/history/[id]" />;
}
