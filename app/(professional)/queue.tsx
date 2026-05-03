import { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { ConversationList } from '@/screens/ConversationList';
import { Icon } from '@/components/ui/Icon';
import { colors, spacing, typography, radius } from '@/constants/theme';

type Status = 'waiting' | 'active' | 'escalated' | 'closed';
type Scope = 'mine' | 'unassigned' | 'all';
type Priority = 'urgent' | 'high' | 'medium' | 'low';

const STATUS_FILTERS: Array<{ label: string; value: Status | undefined }> = [
  { label: 'Todas', value: undefined },
  { label: 'A aguardar', value: 'waiting' },
  { label: 'Em curso', value: 'active' },
  { label: 'Escaladas', value: 'escalated' },
];

const SCOPE_FILTERS: Array<{ label: string; value: Scope }> = [
  { label: 'Minhas', value: 'mine' },
  { label: 'Não atribuídas', value: 'unassigned' },
  { label: 'Todas', value: 'all' },
];

const PRIORITY_FILTERS: Array<{ label: string; value: Priority; color: string }> = [
  { label: 'Urgente', value: 'urgent', color: '#DC2626' },
  { label: 'Alta', value: 'high', color: '#EA580C' },
  { label: 'Média', value: 'medium', color: '#D97706' },
  { label: 'Baixa', value: 'low', color: '#059669' },
];

export default function Queue() {
  const [statusFilter, setStatusFilter] = useState<Status | undefined>(undefined);
  const [scopeFilter, setScopeFilter] = useState<Scope>('mine');
  const [priorityFilter, setPriorityFilter] = useState<Priority | undefined>(undefined);

  const stats = useQuery(api.conversations.queueStats);
  const conversations =
    useQuery(api.conversations.listForProfessional, {
      status: statusFilter,
      scope: scopeFilter,
      priority: priorityFilter,
    }) ?? [];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}
      >
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <StatCard
            label="Minhas"
            value={stats?.mine ?? 0}
            icon={{ sf: 'person.fill', ion: 'person' }}
            color={colors.primary}
          />
          <StatCard
            label="Não atribuídas"
            value={stats?.unassigned ?? 0}
            icon={{ sf: 'tray', ion: 'mail-unread-outline' }}
            color="#D97706"
          />
          <StatCard
            label="Urgentes"
            value={stats?.urgent ?? 0}
            icon={{ sf: 'exclamationmark.triangle.fill', ion: 'warning' }}
            color="#DC2626"
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm }}
        >
          {SCOPE_FILTERS.map((f) => (
            <Chip
              key={f.value}
              label={f.label}
              active={scopeFilter === f.value}
              onPress={() => setScopeFilter(f.value)}
            />
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm }}
        >
          {STATUS_FILTERS.map((f) => (
            <Chip
              key={String(f.value)}
              label={f.label}
              active={statusFilter === f.value}
              onPress={() => setStatusFilter(f.value)}
            />
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm }}
        >
          {PRIORITY_FILTERS.map((f) => (
            <Chip
              key={f.value}
              label={f.label}
              accentColor={f.color}
              active={priorityFilter === f.value}
              onPress={() =>
                setPriorityFilter((cur) => (cur === f.value ? undefined : f.value))
              }
            />
          ))}
        </ScrollView>
      </ScrollView>

      <ConversationList
        conversations={conversations as any}
        basePath="/(professional)/conversations"
        showPriority
      />
    </View>
  );
}

type StatCardProps = {
  label: string;
  value: number;
  icon: { sf: any; ion: any };
  color: string;
};

function StatCard({ label, value, icon, color }: StatCardProps) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background.primary,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        padding: spacing.md,
        gap: spacing.xs,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
        }}
      >
        <Icon name={icon} size={14} color={color} />
        <Text
          style={{
            ...typography.xs,
            color: colors.text.secondary,
            fontWeight: '500',
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
      <Text
        style={{
          ...typography['2xl'],
          fontWeight: '700',
          color: colors.text.primary,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

type ChipProps = {
  label: string;
  active: boolean;
  onPress: () => void;
  accentColor?: string;
};

function Chip({ label, active, onPress, accentColor }: ChipProps) {
  const activeBg = accentColor ?? colors.primary;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.md,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: active ? activeBg : colors.border,
        backgroundColor: active
          ? activeBg
          : pressed
            ? colors.background.tertiary
            : colors.background.primary,
      })}
    >
      <Text
        style={{
          ...typography.sm,
          fontWeight: '600',
          color: active ? '#fff' : colors.text.primary,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
