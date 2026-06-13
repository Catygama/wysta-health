import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from 'convex/react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { api } from '@/convex/_generated/api';
import { ConversationList } from '@/screens/ConversationList';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { fonts } from '@/lib/fonts';

export default function PatientConversations() {
  const conversations = useQuery(api.conversations.listForPatient) ?? [];
  const router = useRouter();
  const { theme } = useUnistyles();

  if (conversations.length === 0) {
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
        <Text style={styles.title}>Sem conversas ainda</Text>
        <Text style={styles.body}>
          Escolhe um tópico para iniciares uma conversa com um profissional de
          saúde.
        </Text>
        <View style={styles.cta}>
          <Button label="Iniciar conversa" onPress={() => router.push('/(patient)/')} />
        </View>
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

const styles = StyleSheet.create((theme) => ({
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
