import { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useQuery } from 'convex/react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { api } from '@/convex/_generated/api';
import { ConversationList } from '@/screens/ConversationList';
import { Icon, type IconName } from '@/components/ui/Icon';
import { fonts } from '@/lib/fonts';

type Status = 'waiting' | 'active' | 'closed';
type Scope = 'mine' | 'unassigned' | 'review' | 'all';
type Priority = 'urgent' | 'high' | 'medium' | 'low';

const STATUS_FILTERS: { label: string; value: Status | undefined }[] = [
  { label: 'Todas', value: undefined },
  { label: 'A aguardar', value: 'waiting' },
  { label: 'Em curso', value: 'active' },
];

const SCOPE_FILTERS: { label: string; value: Scope }[] = [
  { label: 'Minhas', value: 'mine' },
  { label: 'Não atribuídas', value: 'unassigned' },
  { label: 'Para revisão', value: 'review' },
  { label: 'Todas', value: 'all' },
];

const PRIORITY_FILTERS: { label: string; value: Priority; color: string }[] = [
  { label: 'Urgente', value: 'urgent', color: '#D7264C' },
  { label: 'Alta', value: 'high', color: '#D85A30' },
  { label: 'Média', value: 'medium', color: '#C77B16' },
  { label: 'Baixa', value: 'low', color: '#1E6B56' },
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
  const { theme } = useUnistyles();

  return (
    <View style={styles.root}>
      <ScrollView style={styles.headerScroll} contentContainerStyle={styles.header}>
        <View style={styles.statRow}>
          <StatCard
            testID="queue-stat-mine"
            label="Minhas"
            value={stats?.mine ?? 0}
            icon={{ sf: 'person.fill', ion: 'person' }}
            color={theme.colors.ink}
          />
          <StatCard
            testID="queue-stat-unassigned"
            label="Não atribuídas"
            value={stats?.unassigned ?? 0}
            icon={{ sf: 'tray', ion: 'mail-unread-outline' }}
            color={theme.colors.warning}
          />
          <StatCard
            testID="queue-stat-urgent"
            label="Urgentes"
            value={stats?.urgent ?? 0}
            icon={{ sf: 'exclamationmark.triangle.fill', ion: 'warning' }}
            color={theme.colors.danger}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {SCOPE_FILTERS.map((f) => (
            <Chip
              key={f.value}
              testID={`queue-scope-${f.value}`}
              label={f.label}
              active={scopeFilter === f.value}
              onPress={() => setScopeFilter(f.value)}
            />
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {STATUS_FILTERS.map((f) => (
            <Chip
              key={String(f.value)}
              testID={`queue-status-${f.value ?? 'all'}`}
              label={f.label}
              active={statusFilter === f.value}
              onPress={() => setStatusFilter(f.value)}
            />
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {PRIORITY_FILTERS.map((f) => (
            <Chip
              key={f.value}
              testID={`queue-priority-${f.value}`}
              label={f.label}
              accentColor={f.color}
              active={priorityFilter === f.value}
              onPress={() => setPriorityFilter((cur) => (cur === f.value ? undefined : f.value))}
            />
          ))}
        </ScrollView>
      </ScrollView>

      <ConversationList
        conversations={conversations as any}
        basePath="/(professional)/conversations"
        showPriority
        showStatus
      />
    </View>
  );
}

type StatCardProps = {
  label: string;
  value: number;
  icon: IconName;
  color: string;
  testID?: string;
};

function StatCard({ label, value, icon, color, testID }: StatCardProps) {
  return (
    <View testID={testID} style={styles.statCard}>
      <View style={styles.statHead}>
        <Icon name={icon} size={14} color={color} />
        <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

type ChipProps = {
  label: string;
  active: boolean;
  onPress: () => void;
  accentColor?: string;
  testID?: string;
};

function Chip({ label, active, onPress, accentColor, testID }: ChipProps) {
  const { theme } = useUnistyles();
  const activeBg = accentColor ?? theme.colors.ink;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={[styles.chip, active ? { backgroundColor: activeBg } : styles.chipIdle]}
    >
      <Text style={[styles.chipText, active ? styles.chipTextOn : styles.chipTextOff]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.background },
  headerScroll: { flexGrow: 0 },
  header: { padding: theme.spacing.md, gap: theme.spacing.md },
  statRow: { flexDirection: 'row', gap: theme.spacing.sm },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  statHead: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
  statLabel: { fontSize: 12, color: theme.colors.textSecondary, fontWeight: '500' },
  statValue: { fontFamily: fonts.displayExtraBold, fontSize: 24, color: theme.colors.textPrimary },
  chipRow: { gap: theme.spacing.sm },
  chip: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.pill,
    borderCurve: 'continuous',
  },
  chipIdle: { backgroundColor: theme.colors.surface },
  chipText: { fontSize: 14, fontWeight: '500' },
  chipTextOn: { color: theme.colors.onInk },
  chipTextOff: { color: theme.colors.textPrimary },
}));
