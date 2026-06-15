import { useState } from 'react';
import { ScrollView, View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { useQuery, useAction, useMutation } from 'convex/react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { api } from '@/convex/_generated/api';
import { fonts } from '@/lib/fonts';

const STATUS_COLOR: Record<string, string> = {
  pending: '#B7B0C6',
  success: '#1E6B56',
  error: '#D7264C',
  blocked: '#C77B16',
};

export default function AdminAi() {
  const { theme } = useUnistyles();
  const configs = useQuery(api.ai.configs.listConfigsMasked);
  const invocations = useQuery(api.ai.invocations.listLatest);
  const adminTest = useAction(api.ai.chatSummary.adminTest);
  const applyDefaults = useMutation(api.ai.configs.applyDefaults);
  const settings = useQuery(api.ai.settings.currentSettings);
  const updateCap = useMutation(api.ai.settings.updateDailyCostCap);
  const [capInput, setCapInput] = useState('');
  const [savingCap, setSavingCap] = useState(false);
  const [capMsg, setCapMsg] = useState<string | null>(null);

  async function saveCap() {
    setCapMsg(null);
    const usd = Number(capInput);
    if (!isFinite(usd) || usd <= 0 || usd > 100) {
      setCapMsg('Insere um valor entre 0 e 100 USD.');
      return;
    }
    setSavingCap(true);
    try {
      await updateCap({ dailyCostCapUsd: usd });
      setCapInput('');
      setCapMsg(`Limite atualizado para $${usd.toFixed(2)}/dia/utente.`);
    } catch (e: any) {
      setCapMsg(e?.message ?? 'Falha');
    } finally {
      setSavingCap(false);
    }
  }
  const [input, setInput] = useState(
    'Utente: Tenho dores menstruais fortes há 3 meses.\nProfissional: Recomendo ibuprofeno 400mg de 8/8h e consulta presencial.'
  );
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [applying, setApplying] = useState(false);
  const [applyMsg, setApplyMsg] = useState<string | null>(null);

  async function applySetup() {
    setApplyMsg(null);
    if (keyInput.trim().length < 10) {
      setApplyMsg('Cola uma API key válida.');
      return;
    }
    setApplying(true);
    try {
      await applyDefaults({ purpose: 'chat-summary', apiKey: keyInput.trim() });
      setKeyInput('');
      setApplyMsg('Setup aplicado. Config + prompt default em vigor.');
    } catch (e: any) {
      setApplyMsg(e?.message ?? 'Falha ao aplicar setup');
    } finally {
      setApplying(false);
    }
  }

  async function runTest() {
    setError(null);
    setResult(null);
    setRunning(true);
    try {
      const r = await adminTest({ conversationText: input });
      setResult(r.summary);
    } catch (e: any) {
      setError(e?.message ?? 'Falha');
    } finally {
      setRunning(false);
    }
  }

  const capDisabled = savingCap || capInput.trim().length === 0;
  const applyDisabled = applying || keyInput.trim().length === 0;
  const testDisabled = running || input.trim().length === 0;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Card title="Limite diário por utente">
        <Text style={styles.hint}>
          Cada chamada AI conta para o gasto total do utente nas últimas 24h. Acima
          do limite, o `runAgent` rejeita até passarem 24h.
        </Text>
        <View style={styles.inlineRow}>
          <Text style={styles.capValue}>
            {settings === undefined ? '...' : `$${settings.dailyCostCapUsd.toFixed(2)}`}
          </Text>
          {settings && !settings.hasOverride && (
            <Text style={styles.muted}>(default — nunca alterado)</Text>
          )}
          {settings?.lastChangedAt && (
            <Text style={styles.muted}>
              alterado {new Date(settings.lastChangedAt).toLocaleDateString('pt-PT')}
            </Text>
          )}
        </View>
        <View style={styles.inputRow}>
          <TextInput
            testID="admin-ai-cap-input"
            value={capInput}
            onChangeText={setCapInput}
            placeholder="Novo valor em USD"
            placeholderTextColor={theme.colors.textTertiary as any}
            keyboardType="decimal-pad"
            style={styles.fieldInline}
          />
          <Pressable
            testID="admin-ai-cap-save"
            disabled={capDisabled}
            onPress={saveCap}
            style={[styles.btn, capDisabled ? styles.btnOff : styles.btnOn]}
          >
            {savingCap && <ActivityIndicator color={theme.colors.onInk} size="small" />}
            <Text style={[styles.btnText, capDisabled && styles.btnTextOff]}>Guardar</Text>
          </Pressable>
        </View>
        {capMsg && (
          <Text style={capMsg.startsWith('Limite') ? styles.ok : styles.error}>{capMsg}</Text>
        )}
      </Card>

      <Card title="Setup default — chat-summary">
        <Text style={styles.hint}>
          Cola uma API key OpenAI. Insere config (gpt-4o-mini) + prompt clínico
          default. Append-only — corre várias vezes para rotação de key.
        </Text>
        <TextInput
          testID="admin-ai-key-input"
          value={keyInput}
          onChangeText={setKeyInput}
          placeholder="sk-proj-..."
          placeholderTextColor={theme.colors.textTertiary as any}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.field}
        />
        <Pressable
          testID="admin-ai-apply-defaults"
          disabled={applyDisabled}
          onPress={applySetup}
          style={[styles.btnBlock, applyDisabled ? styles.btnOff : styles.btnOn]}
        >
          {applying && <ActivityIndicator color={theme.colors.onInk} size="small" />}
          <Text style={[styles.btnText, applyDisabled && styles.btnTextOff]}>
            {applying ? 'A aplicar...' : 'Aplicar setup default'}
          </Text>
        </Pressable>
        {applyMsg && (
          <Text style={applyMsg.startsWith('Setup') ? styles.ok : styles.error}>{applyMsg}</Text>
        )}
      </Card>

      <Card title="Teste rápido — chat-summary">
        <TextInput
          testID="admin-ai-test-input"
          multiline
          value={input}
          onChangeText={setInput}
          placeholder="Texto da conversa para sumarizar..."
          placeholderTextColor={theme.colors.textTertiary as any}
          style={styles.fieldMultiline}
        />
        <Pressable
          testID="admin-ai-test-run"
          disabled={testDisabled}
          onPress={runTest}
          style={[styles.btnBlock, testDisabled ? styles.btnOff : styles.btnOn]}
        >
          {running && <ActivityIndicator color={theme.colors.onInk} size="small" />}
          <Text style={[styles.btnText, testDisabled && styles.btnTextOff]}>
            {running ? 'A correr...' : 'Correr'}
          </Text>
        </Pressable>
        {error && <Text style={styles.error}>{error}</Text>}
        {result && (
          <View style={styles.resultBox}>
            <Text style={styles.resultText}>{result}</Text>
          </View>
        )}
      </Card>

      <Card title="Configs (latest por purpose)">
        {configs === undefined ? (
          <ActivityIndicator color={theme.colors.ink} />
        ) : configs.length === 0 ? (
          <Text style={styles.muted}>
            Sem configs. Seed via `bunx convex run ai/setup:seedConfig` ou painel.
          </Text>
        ) : (
          configs.slice(0, 20).map((c) => (
            <Row key={c._id} left={`${c.purpose}`} center={`${c.provider} / ${c.modelId}`} right={c.apiKey} />
          ))
        )}
      </Card>

      <Card title="Invocações recentes (50)">
        {invocations === undefined ? (
          <ActivityIndicator color={theme.colors.ink} />
        ) : invocations.length === 0 ? (
          <Text style={styles.muted}>Ainda sem invocações.</Text>
        ) : (
          invocations.map((inv) => (
            <View key={inv._id} style={styles.invRow}>
              <View style={styles.invTop}>
                <Text style={styles.invPurpose}>{inv.purpose}</Text>
                <Text style={[styles.invStatus, { color: STATUS_COLOR[inv.status] ?? theme.colors.textSecondary }]}>
                  {inv.status.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.muted}>
                {new Date(inv._creationTime).toLocaleString('pt-PT')}
                {inv.latencyMs !== undefined && ` · ${inv.latencyMs}ms`}
                {inv.inputTokens !== undefined && ` · ${inv.inputTokens}/${inv.outputTokens ?? 0} tok`}
                {inv.costUsd !== undefined && ` · $${inv.costUsd.toFixed(6)}`}
              </Text>
              {inv.errorMessage && <Text style={styles.error}>{inv.errorMessage}</Text>}
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ left, center, right }: { left: string; center: string; right: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLeft}>{left}</Text>
      <Text style={styles.rowCenter}>{center}</Text>
      <Text style={styles.rowRight}>{right}</Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, gap: theme.spacing.lg },
  card: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    gap: theme.spacing.sm,
  },
  cardTitle: { fontFamily: fonts.displayBold, fontSize: 16, color: theme.colors.textPrimary },
  hint: { fontSize: 12, color: theme.colors.textSecondary },
  muted: { fontSize: 12, color: theme.colors.textTertiary },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, flexWrap: 'wrap' },
  capValue: { fontFamily: fonts.displayBold, fontSize: 18, color: theme.colors.ink },
  inputRow: { flexDirection: 'row', gap: theme.spacing.sm },
  field: {
    fontSize: 14,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surfaceSunken,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    padding: theme.spacing.sm,
  },
  fieldInline: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surfaceSunken,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    padding: theme.spacing.sm,
  },
  fieldMultiline: {
    fontSize: 14,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surfaceSunken,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    padding: theme.spacing.sm,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  btn: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  btnBlock: {
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  btnOn: { backgroundColor: theme.colors.ink },
  btnOff: { backgroundColor: theme.colors.surfaceSunken },
  btnText: { fontSize: 14, fontWeight: '500', color: theme.colors.onInk },
  btnTextOff: { color: theme.colors.textTertiary },
  ok: { fontSize: 14, color: theme.colors.success },
  error: { fontSize: 14, color: theme.colors.danger },
  resultBox: {
    backgroundColor: theme.colors.surfaceSunken,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
  },
  resultText: { fontSize: 14, color: theme.colors.textPrimary, lineHeight: 22 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
    gap: theme.spacing.sm,
  },
  rowLeft: { fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary, flex: 1 },
  rowCenter: { fontSize: 14, color: theme.colors.textSecondary, flex: 1 },
  rowRight: { fontSize: 12, color: theme.colors.textSecondary, fontFamily: 'monospace' },
  invRow: {
    paddingVertical: theme.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
    gap: 2,
  },
  invTop: { flexDirection: 'row', justifyContent: 'space-between' },
  invPurpose: { fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },
  invStatus: { fontSize: 12, fontWeight: '500' },
}));
