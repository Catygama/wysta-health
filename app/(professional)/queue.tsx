import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { ConversationList } from '@/screens/ConversationList';
import { colors, spacing, typography, radius } from '@/constants/theme';

const FILTERS = [
  { label: 'Todas', value: undefined },
  { label: 'A aguardar', value: 'waiting' },
  { label: 'Em curso', value: 'active' },
  { label: 'Escaladas', value: 'escalated' },
];

export default function Queue() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const conversations =
    useQuery(api.conversations.listForProfessional, { status: statusFilter }) ?? [];

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, padding: spacing.md, paddingBottom: 0 }}>
        {FILTERS.map((f) => (
          <Pressable
            key={String(f.value)}
            onPress={() => setStatusFilter(f.value)}
            style={{
              paddingVertical: spacing.xs,
              paddingHorizontal: spacing.md,
              borderRadius: radius.full,
              backgroundColor: statusFilter === f.value ? colors.primary : colors.background.tertiary,
            }}
          >
            <Text style={{ ...typography.sm, fontWeight: '500', color: statusFilter === f.value ? '#fff' : colors.text.secondary }}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <ConversationList
        conversations={conversations as any}
        basePath="/(professional)/conversations"
      />
    </View>
  );
}
