import { useState } from 'react';
import { Text, View } from 'react-native';
import { useMutation } from 'convex/react';
import { StyleSheet } from 'react-native-unistyles';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/Button';
import { fonts } from '@/lib/fonts';

// Adds the built-in triages and articles that are missing and refreshes the
// ones nobody edited. Whatever an admin edited in Conteúdos is kept.
export function SeedContentCard() {
  const seedAll = useMutation(api.seed.seedAll);
  const [seeding, setSeeding] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function run() {
    setSeeding(true);
    setResult(null);
    try {
      const r = await seedAll();
      setResult(
        `Triagem: ${r.triage.inserted} inseridas, ${r.triage.updated} atualizadas, ${r.triage.kept} editadas mantidas. ` +
          `Artigos: ${r.articles.inserted} inseridos, ${r.articles.updated} atualizados, ${r.articles.kept} editados mantidos. ` +
          `Níveis de alerta atribuídos a ${r.alertLevelsBackfilled} conversas.`
      );
    } catch (e: any) {
      setResult(e?.message ?? 'Erro ao atualizar os conteúdos.');
    } finally {
      setSeeding(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Conteúdos de origem</Text>
      <Text style={styles.sub}>
        Acrescenta as triagens e os artigos pré-definidos que faltem e atualiza os que ninguém
        editou. O que foi editado aqui fica como está.
      </Text>
      <Button
        testID="admin-seed-button"
        label="Atualizar triagens e artigos"
        variant="secondary"
        onPress={run}
        loading={seeding}
      />
      {result && (
        <Text testID="admin-seed-result" style={styles.sub}>
          {result}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  title: { fontFamily: fonts.displayBold, fontSize: 16, color: theme.colors.textPrimary },
  sub: { fontSize: 14, color: theme.colors.textSecondary },
}));
