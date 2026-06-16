import { View, Text } from 'react-native';
import { useQuery } from 'convex/react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { api } from '@/convex/_generated/api';
import { fonts } from '@/lib/fonts';

// `invert: true` metrics are negative — a high value is worse. They use a
// warning colour so a full bar reads as "vigiar" rather than "bom".
const METRICS = [
  { key: 'desire', label: 'Desejo', max: 5, invert: false },
  { key: 'satisfaction', label: 'Satisfação', max: 5, invert: false },
  { key: 'pain', label: 'Dor', max: 5, invert: true },
  { key: 'distress', label: 'Mal-estar', max: 5, invert: true },
] as const;

export function WellbeingTrend() {
  const { theme } = useUnistyles();
  const checkins = useQuery(api.wellbeing.listCheckins, { limit: 8 });

  if (checkins === undefined) return null;

  if (checkins.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>O teu bem-estar sexual</Text>
        <Text style={styles.empty}>
          {`Ainda sem check-ins. Faz um ao abrir o tópico "Bem-estar sexual".`}
        </Text>
      </View>
    );
  }

  const latest = checkins[0];
  const desireSeries = [...checkins].reverse().map((c) => c.desire);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>O teu bem-estar sexual</Text>
      <Text style={styles.sub}>Último check-in</Text>
      {METRICS.map((m) => {
        const value = (latest as unknown as Record<string, number>)[m.key];
        const pct = Math.max(0, Math.min(100, Math.round((value / m.max) * 100)));
        const accent = m.invert ? theme.colors.warning : theme.topic.wellbeing.on;
        return (
          <View key={m.key} style={styles.metricRow}>
            <Text style={styles.metricLabel}>{m.label}</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: accent }]} />
            </View>
            <Text style={[styles.metricVal, m.invert && { color: accent }]}>{value}</Text>
          </View>
        );
      })}
      {desireSeries.length > 1 && (
        <View style={styles.sparkWrap}>
          <Text style={styles.sub}>Desejo ao longo do tempo</Text>
          <View style={styles.sparkRow}>
            {desireSeries.map((v, i) => (
              <View
                key={i}
                style={[
                  styles.sparkBar,
                  { height: 8 + (v / 5) * 36, backgroundColor: theme.topic.wellbeing.fill },
                ]}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  title: { fontFamily: fonts.displayBold, fontSize: 16, color: theme.colors.textPrimary },
  sub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: theme.spacing.xs },
  empty: { fontSize: 14, color: theme.colors.textSecondary },
  metricRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  metricLabel: { fontSize: 13, color: theme.colors.textPrimary, width: 80 },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: theme.colors.surfaceSunken,
    borderRadius: theme.radius.pill,
    overflow: 'hidden',
  },
  barFill: { height: 8, borderRadius: theme.radius.pill },
  metricVal: { fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary, width: 16, textAlign: 'right' },
  sparkWrap: { gap: theme.spacing.xs, marginTop: theme.spacing.sm },
  sparkRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 44 },
  sparkBar: { flex: 1, borderRadius: 4, borderCurve: 'continuous' },
}));
