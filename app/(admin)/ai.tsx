import { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useAction, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { spacing, typography, radius } from '@/constants/theme';
import { useTheme } from '@/lib/theme';

const STATUS_COLOR: Record<string, string> = {
  pending: '#9CA3AF',
  success: '#059669',
  error: '#DC2626',
  blocked: '#D97706',
};

export default function AdminAi() {
  const { colors } = useTheme();
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

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background.primary }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
      contentInsetAdjustmentBehavior="automatic"
    >
      {/* Cost cap */}
      <Card title="Limite diário por utente" colors={colors}>
        <Text style={{ ...typography.xs, color: colors.text.secondary }}>
          Cada chamada AI conta para o gasto total do utente nas últimas 24h.
          Acima do limite, o `runAgent` rejeita até passarem 24h.
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={{ ...typography.lg, fontWeight: '700', color: colors.primary }}>
            {settings === undefined
              ? '...'
              : `$${settings.dailyCostCapUsd.toFixed(2)}`}
          </Text>
          {settings && !settings.hasOverride && (
            <Text style={{ ...typography.xs, color: colors.text.tertiary }}>
              (default — nunca alterado)
            </Text>
          )}
          {settings?.lastChangedAt && (
            <Text style={{ ...typography.xs, color: colors.text.tertiary }}>
              alterado {new Date(settings.lastChangedAt).toLocaleDateString('pt-PT')}
            </Text>
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <TextInput
            testID="admin-ai-cap-input"
            value={capInput}
            onChangeText={setCapInput}
            placeholder="Novo valor em USD"
            placeholderTextColor={colors.text.secondary}
            keyboardType="decimal-pad"
            style={{
              ...typography.sm,
              flex: 1,
              color: colors.text.primary,
              backgroundColor: colors.background.primary,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              padding: spacing.sm,
            }}
          />
          <Pressable
            testID="admin-ai-cap-save"
            disabled={savingCap || capInput.trim().length === 0}
            onPress={saveCap}
            style={{
              backgroundColor:
                savingCap || capInput.trim().length === 0 ? colors.border : colors.primary,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              borderRadius: radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: spacing.xs,
            }}
          >
            {savingCap && <ActivityIndicator color="#fff" size="small" />}
            <Text style={{ ...typography.sm, fontWeight: '600', color: '#fff' }}>
              Guardar
            </Text>
          </Pressable>
        </View>
        {capMsg && (
          <Text
            style={{
              ...typography.sm,
              color: capMsg.startsWith('Limite') ? colors.primary : colors.danger,
            }}
          >
            {capMsg}
          </Text>
        )}
      </Card>

      {/* Setup default — applies canonical config + prompt with the supplied key */}
      <Card title="Setup default — chat-summary" colors={colors}>
        <Text style={{ ...typography.xs, color: colors.text.secondary }}>
          Cola uma API key OpenAI. Insere config (gpt-4o-mini) + prompt clínico
          default. Append-only — corre várias vezes para rotação de key.
        </Text>
        <TextInput
          testID="admin-ai-key-input"
          value={keyInput}
          onChangeText={setKeyInput}
          placeholder="sk-proj-..."
          placeholderTextColor={colors.text.secondary}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          style={{
            ...typography.sm,
            color: colors.text.primary,
            backgroundColor: colors.background.primary,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.sm,
          }}
        />
        <Pressable
          testID="admin-ai-apply-defaults"
          disabled={applying || keyInput.trim().length === 0}
          onPress={applySetup}
          style={{
            backgroundColor:
              applying || keyInput.trim().length === 0 ? colors.border : colors.primary,
            paddingVertical: spacing.sm,
            borderRadius: radius.md,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: spacing.xs,
          }}
        >
          {applying && <ActivityIndicator color="#fff" size="small" />}
          <Text style={{ ...typography.sm, fontWeight: '600', color: '#fff' }}>
            {applying ? 'A aplicar...' : 'Aplicar setup default'}
          </Text>
        </Pressable>
        {applyMsg && (
          <Text
            style={{
              ...typography.sm,
              color: applyMsg.startsWith('Setup') ? colors.primary : colors.danger,
            }}
          >
            {applyMsg}
          </Text>
        )}
      </Card>

      {/* Test form */}
      <Card title="Teste rápido — chat-summary" colors={colors}>
        <TextInput
          testID="admin-ai-test-input"
          multiline
          value={input}
          onChangeText={setInput}
          placeholder="Texto da conversa para sumarizar..."
          placeholderTextColor={colors.text.secondary}
          style={{
            ...typography.sm,
            color: colors.text.primary,
            backgroundColor: colors.background.primary,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.sm,
            minHeight: 100,
            textAlignVertical: 'top',
          }}
        />
        <Pressable
          testID="admin-ai-test-run"
          disabled={running || input.trim().length === 0}
          onPress={runTest}
          style={{
            backgroundColor:
              running || input.trim().length === 0 ? colors.border : colors.primary,
            paddingVertical: spacing.sm,
            borderRadius: radius.md,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: spacing.xs,
          }}
        >
          {running && <ActivityIndicator color="#fff" size="small" />}
          <Text style={{ ...typography.sm, fontWeight: '600', color: '#fff' }}>
            {running ? 'A correr...' : 'Correr'}
          </Text>
        </Pressable>
        {error && (
          <Text style={{ ...typography.sm, color: colors.danger }}>{error}</Text>
        )}
        {result && (
          <View
            style={{
              backgroundColor: colors.primaryLight,
              padding: spacing.md,
              borderRadius: radius.md,
            }}
          >
            <Text
              style={{ ...typography.sm, color: colors.text.primary, lineHeight: 22 }}
            >
              {result}
            </Text>
          </View>
        )}
      </Card>

      {/* Configs */}
      <Card title="Configs (latest por purpose)" colors={colors}>
        {configs === undefined ? (
          <ActivityIndicator color={colors.primary} />
        ) : configs.length === 0 ? (
          <Text style={{ ...typography.sm, color: colors.text.secondary }}>
            Sem configs. Seed via `bunx convex run ai/setup:seedConfig` ou painel.
          </Text>
        ) : (
          configs.slice(0, 20).map((c) => (
            <Row
              key={c._id}
              colors={colors}
              left={`${c.purpose}`}
              center={`${c.provider} / ${c.modelId}`}
              right={c.apiKey}
            />
          ))
        )}
      </Card>

      {/* Invocations */}
      <Card title="Invocações recentes (50)" colors={colors}>
        {invocations === undefined ? (
          <ActivityIndicator color={colors.primary} />
        ) : invocations.length === 0 ? (
          <Text style={{ ...typography.sm, color: colors.text.secondary }}>
            Ainda sem invocações.
          </Text>
        ) : (
          invocations.map((inv) => (
            <View
              key={inv._id}
              style={{
                paddingVertical: spacing.xs,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                gap: 2,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ ...typography.sm, fontWeight: '600', color: colors.text.primary }}>
                  {inv.purpose}
                </Text>
                <Text
                  style={{
                    ...typography.xs,
                    fontWeight: '700',
                    color: STATUS_COLOR[inv.status] ?? colors.text.secondary,
                  }}
                >
                  {inv.status.toUpperCase()}
                </Text>
              </View>
              <Text style={{ ...typography.xs, color: colors.text.secondary }}>
                {new Date(inv._creationTime).toLocaleString('pt-PT')}
                {inv.latencyMs !== undefined && ` · ${inv.latencyMs}ms`}
                {inv.inputTokens !== undefined &&
                  ` · ${inv.inputTokens}/${inv.outputTokens ?? 0} tok`}
                {inv.costUsd !== undefined && ` · $${inv.costUsd.toFixed(6)}`}
              </Text>
              {inv.errorMessage && (
                <Text style={{ ...typography.xs, color: colors.danger }}>
                  {inv.errorMessage}
                </Text>
              )}
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
}

function Card({
  title,
  children,
  colors,
}: {
  title: string;
  children: React.ReactNode;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <View
      style={{
        backgroundColor: colors.background.secondary,
        padding: spacing.md,
        borderRadius: radius.md,
        gap: spacing.sm,
      }}
    >
      <Text style={{ ...typography.md, fontWeight: '700', color: colors.text.primary }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Row({
  left,
  center,
  right,
  colors,
}: {
  left: string;
  center: string;
  right: string;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.xs,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        gap: spacing.sm,
      }}
    >
      <Text style={{ ...typography.sm, fontWeight: '600', color: colors.text.primary, flex: 1 }}>
        {left}
      </Text>
      <Text style={{ ...typography.sm, color: colors.text.secondary, flex: 1 }}>
        {center}
      </Text>
      <Text style={{ ...typography.xs, color: colors.text.secondary, fontFamily: 'monospace' }}>
        {right}
      </Text>
    </View>
  );
}
