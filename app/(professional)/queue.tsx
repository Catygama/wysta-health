import { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useQuery } from 'convex/react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { api } from '@/convex/_generated/api';
import { ConversationList } from '@/screens/ConversationList';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
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

const PRIORITY_FILTERS: { label: string; value: Priority }[] = [
  { label: 'Urgente', value: 'urgent' },
  { label: 'Alta', value: 'high' },
  { label: 'Média', value: 'medium' },
  { label: 'Baixa', value: 'low' },
];

const EMPTY_TEXT: Record<Scope, string> = {
  mine: 'Não tens conversas atribuídas.',
  unassigned: 'Não há conversas por atribuir.',
  review: 'Nada para rever.',
  all: 'Sem conversas com estes filtros.',
};

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
  // From the theme so the active chip stays legible in dark mode.
  const priorityColor: Record<Priority, string> = {
    urgent: theme.colors.danger,
    high: theme.colors.danger,
    medium: theme.colors.warning,
    low: theme.colors.success,
  };

  function showScope(scope: Scope, priority?: Priority) {
    setScopeFilter(scope);
    setStatusFilter(undefined);
    setPriorityFilter(priority);
  }

  const hasUnassigned = (stats?.unassigned ?? 0) > 0;

  return (
    <View style={styles.root}>
      <ScrollView style={styles.headerScroll} contentContainerStyle={styles.header}>
        <View style={styles.statRow}>
          <StatCard
            testID="queue-stat-mine"
            label="Minhas"
            value={stats?.mine ?? 0}
            icon={{ sf: 'person.fill', ion: 'person' }}
            color={theme.colors.inkText}
            onPress={() => showScope('mine')}
          />
          <StatCard
            testID="queue-stat-unassigned"
            label="Não atribuídas"
            value={stats?.unassigned ?? 0}
            icon={{ sf: 'tray', ion: 'mail-unread-outline' }}
            color={theme.colors.warning}
            onPress={() => showScope('unassigned')}
          />
          <StatCard
            testID="queue-stat-urgent"
            label="Urgentes"
            value={stats?.urgent ?? 0}
            icon={{ sf: 'exclamationmark.triangle.fill', ion: 'warning' }}
            color={theme.colors.danger}
            onPress={() => showScope('all', 'urgent')}
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
              accentColor={priorityColor[f.value]}
              active={priorityFilter === f.value}
              onPress={() => setPriorityFilter((cur) => (cur === f.value ? undefined : f.value))}
            />
          ))}
        </ScrollView>
      </ScrollView>

      <ConversationList
        conversations={conversations as any}
        basePath="/(professional)/cases"
        showPriority
        showStatus
        emptyComponent={
          <View testID="queue-empty" style={styles.empty}>
            <Text style={styles.emptyText}>{EMPTY_TEXT[scopeFilter]}</Text>
            {scopeFilter === 'mine' && hasUnassigned && (
              <Button
                testID="queue-empty-show-unassigned"
                kind="secondary"
                size="sm"
                label={`Ver não atribuídas (${stats?.unassigned})`}
                onPress={() => showScope('unassigned')}
              />
            )}
          </View>
        }
      />
    </View>
  );
}

type StatCardProps = {
  label: string;
  value: number;
  icon: IconName;
  color: string;
  onPress: () => void;
  testID?: string;
};

// Doubles as a shortcut to the matching filter.
function StatCard({ label, value, icon, color, onPress, testID }: StatCardProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
      style={({ pressed }) => [styles.statCard, pressed && styles.statPressed]}
    >
      <View style={styles.statHead}>
        <Icon name={icon} size={14} color={color} />
        <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
    </Pressable>
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
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      hitSlop={6}
      onPress={onPress}
      style={[styles.chip, active ? { backgroundColor: activeBg } : styles.chipIdle]}
    >
      <Text
        style={[
          styles.chipText,
          active ? styles.chipTextOn : styles.chipTextOff,
          // Priority fills are light in dark mode; onDanger flips to dark text there.
          active && accentColor ? { color: theme.colors.onDanger } : null,
        ]}
      >
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
  statPressed: { opacity: 0.85 },
  empty: { padding: theme.spacing.xl, alignItems: 'center', gap: theme.spacing.md },
  emptyText: { fontSize: 15, color: theme.colors.textSecondary, textAlign: 'center' },
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
