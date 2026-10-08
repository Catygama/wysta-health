import { useState, Fragment } from 'react';
import { ScrollView, View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { useQuery, useAction, useMutation } from 'convex/react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { FunctionReturnType } from 'convex/server';
import { api } from '@/convex/_generated/api';
import { errorText } from '@/lib/errorText';
import { fonts } from '@/lib/fonts';
import type { TopicId } from '@/convex/lib/topics';

const STATUS_COLOR: Record<string, string> = {
  pending: '#B7B0C6',
  success: '#1E6B56',
  error: '#D7264C',
  blocked: '#C77B16',
};

type Overview = FunctionReturnType<typeof api.ai.admin.overview>;
type PurposeRow = Overview['purposes'][number];

export default function AdminAi() {
  const { theme } = useUnistyles();
  const overview = useQuery(api.ai.admin.overview);
  const invocations = useQuery(api.ai.invocations.listLatest);
  const settings = useQuery(api.ai.settings.currentSettings);
  const updateCap = useMutation(api.ai.settings.updateDailyCostCap);

  const [capInput, setCapInput] = useState('');
  const [savingCap, setSavingCap] = useState(false);
  const [capMsg, setCapMsg] = useState<string | null>(null);

  // Card open state is lifted so the pipeline diagram can open a card on tap.
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const toggle = (purpose: string) =>
    setOpenMap((m) => ({ ...m, [purpose]: !m[purpose] }));
  const focus = (purpose: string) => setOpenMap((m) => ({ ...m, [purpose]: true }));

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
      setCapMsg(errorText(e, 'Não foi possível concluir.'));
    } finally {
      setSavingCap(false);
    }
  }

  const capDisabled = savingCap || capInput.trim().length === 0;

  const groups = overview
    ? {
        resumos: overview.purposes.filter((p) => p.meta.group === 'resumos'),
        assistente: overview.purposes.filter((p) => p.meta.group === 'assistente'),
      }
    : null;

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
            <Text style={styles.muted}>(valor predefinido, nunca alterado)</Text>
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
            accessibilityRole="button"
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

      {overview === undefined ? (
        <ActivityIndicator color={theme.colors.inkText} style={{ marginTop: 24 }} />
      ) : (
        <>
          <PipelineDiagram
            pipelines={overview.pipelines}
            purposes={overview.purposes}
            onSelect={focus}
          />

          <SectionLabel>Resumos</SectionLabel>
          {groups!.resumos.map((row) => (
            <PurposeCard
              key={row.purpose}
              row={row}
              providers={overview.providers}
              wired={overview.wiredProviders}
              open={!!openMap[row.purpose]}
              onToggle={() => toggle(row.purpose)}
              availableTopics={overview.availableTopics}
            />
          ))}

          <SectionLabel>Assistente (cadeia de segurança)</SectionLabel>
          {groups!.assistente.map((row) => (
            <PurposeCard
              key={row.purpose}
              row={row}
              providers={overview.providers}
              wired={overview.wiredProviders}
              open={!!openMap[row.purpose]}
              onToggle={() => toggle(row.purpose)}
              availableTopics={overview.availableTopics}
            />
          ))}
        </>
      )}

      <Card title="Invocações recentes (10)">
        {invocations === undefined ? (
          <ActivityIndicator color={theme.colors.inkText} />
        ) : invocations.length === 0 ? (
          <Text style={styles.muted}>Ainda sem invocações.</Text>
        ) : (
          invocations.map((inv) => (
            <View key={inv._id} style={styles.invRow}>
              <View style={styles.invTop}>
                <Text style={styles.invPurpose}>{inv.purpose}</Text>
                <Text
                  style={[
                    styles.invStatus,
                    { color: STATUS_COLOR[inv.status] ?? theme.colors.textSecondary },
                  ]}
                >
                  {inv.status.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.muted}>
                {new Date(inv._creationTime).toLocaleString('pt-PT')}
                {inv.latencyMs !== undefined && ` · ${inv.latencyMs}ms`}
                {inv.inputTokens !== undefined && ` · ${inv.inputTokens}/${inv.outputTokens ?? 0} tokens`}
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

// --- Pipeline diagram -----------------------------------------------------

// Lays each pipeline out in topological levels (entry nodes at the top, each
// node below its dependencies) so the chain reads draft → validators → judge.
function levelsOf(steps: Overview['pipelines'][number]['steps']) {
  const byPurpose = new Map(steps.map((s) => [s.purpose, s]));
  const memo = new Map<string, number>();
  const lvl = (p: string): number => {
    if (memo.has(p)) return memo.get(p)!;
    const s = byPurpose.get(p as any);
    const v = !s || s.dependsOn.length === 0 ? 0 : 1 + Math.max(...s.dependsOn.map((d) => lvl(d)));
    memo.set(p, v);
    return v;
  };
  const max = Math.max(0, ...steps.map((s) => lvl(s.purpose)));
  const rows: string[][] = Array.from({ length: max + 1 }, () => []);
  for (const s of steps) rows[lvl(s.purpose)].push(s.purpose);
  return rows;
}

function PipelineDiagram({
  pipelines,
  purposes,
  onSelect,
}: {
  pipelines: Overview['pipelines'];
  purposes: PurposeRow[];
  onSelect: (purpose: string) => void;
}) {
  const info: Record<string, { label: string; model: string | null; configured: boolean }> = {};
  for (const p of purposes) {
    info[p.purpose] = {
      label: p.meta.label,
      model: p.config ? `${p.config.provider} / ${p.config.modelId}` : null,
      configured: !!p.config && !!p.prompt,
    };
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Como os agentes se ligam</Text>
      <Text style={styles.hint}>Toca num nó para abrir a sua configuração.</Text>
      {pipelines.map((pl) => {
        const rows = levelsOf(pl.steps);
        return (
          <View key={pl.id} style={styles.pipelineBlock}>
            <Text style={styles.pipelineLabel}>{pl.label}</Text>
            <Text style={styles.muted}>{pl.description}</Text>
            {rows.map((row, i) => (
              <Fragment key={i}>
                <View style={styles.diagRow}>
                  {row.map((p) => (
                    <DiagramNode key={p} purpose={p} info={info[p]} onSelect={onSelect} />
                  ))}
                </View>
                {i < rows.length - 1 && (
                  <View style={styles.connector}>
                    <View style={styles.connectorLine} />
                  </View>
                )}
              </Fragment>
            ))}
          </View>
        );
      })}
    </View>
  );
}

function DiagramNode({
  purpose,
  info,
  onSelect,
}: {
  purpose: string;
  info?: { label: string; model: string | null; configured: boolean };
  onSelect: (purpose: string) => void;
}) {
  const { theme } = useUnistyles();
  return (
    <Pressable
      testID={`admin-ai-node-${purpose}`}
      accessibilityRole="button"
      onPress={() => onSelect(purpose)}
      style={styles.node}
    >
      <View
        style={[
          styles.nodeDot,
          { backgroundColor: info?.configured ? theme.colors.success : theme.colors.warning },
        ]}
      />
      <Text style={styles.nodeLabel} numberOfLines={2}>
        {info?.label ?? purpose}
      </Text>
      <Text style={styles.nodeModel} numberOfLines={1}>
        {info?.model ?? 'sem configuração'}
      </Text>
    </Pressable>
  );
}

// --- Per-purpose editor ---------------------------------------------------

function PurposeCard({
  row,
  providers,
  wired,
  open,
  onToggle,
  availableTopics,
}: {
  row: PurposeRow;
  providers: readonly string[];
  wired: readonly string[];
  open: boolean;
  onToggle: () => void;
  availableTopics: readonly string[];
}) {
  const { theme } = useUnistyles();

  const configured = !!row.config && !!row.prompt;

  return (
    <View style={styles.card}>
      <Pressable
        testID={`admin-ai-purpose-${row.purpose}`}
        accessibilityRole="button"
        aria-expanded={open}
        onPress={onToggle}
        style={styles.purposeHeader}
      >
        <View style={styles.purposeHeaderText}>
          <Text style={styles.cardTitle}>{row.meta.label}</Text>
          <Text style={styles.muted}>
            {row.config ? `${row.config.provider} / ${row.config.modelId}` : 'sem configuração'}
          </Text>
        </View>
        <View style={styles.purposeHeaderRight}>
          <View
            style={[
              styles.dot,
              { backgroundColor: configured ? theme.colors.success : theme.colors.warning },
            ]}
          />
          <Text style={styles.chevron}>{open ? '▲' : '▼'}</Text>
        </View>
      </Pressable>

      {open && (
        <View style={styles.purposeBody}>
          <Text style={styles.hint}>{row.meta.description}</Text>
          <ConfigEditor row={row} providers={providers} wired={wired} />
          <PromptEditor row={row} availableTopics={availableTopics} />
          <TestRunner row={row} />
        </View>
      )}
    </View>
  );
}

function ConfigEditor({
  row,
  providers,
  wired,
}: {
  row: PurposeRow;
  providers: readonly string[];
  wired: readonly string[];
}) {
  const { theme } = useUnistyles();
  const saveConfig = useMutation(api.ai.admin.saveConfig);

  const [provider, setProvider] = useState(row.config?.provider ?? 'openai');
  const [modelId, setModelId] = useState(row.config?.modelId ?? '');
  const [endpoint, setEndpoint] = useState(row.config?.endpoint ?? '');
  const [keyEdit, setKeyEdit] = useState('');
  const [reveal, setReveal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const revealed = useQuery(
    api.ai.admin.revealKey,
    reveal ? { purpose: row.purpose } : 'skip'
  );

  async function save() {
    setMsg(null);
    if (modelId.trim().length === 0) {
      setMsg('Indica o modelo.');
      return;
    }
    setSaving(true);
    try {
      await saveConfig({
        purpose: row.purpose,
        provider: provider as any,
        modelId: modelId.trim(),
        endpoint: endpoint.trim() || undefined,
        apiKey: keyEdit.trim() || undefined,
      });
      setKeyEdit('');
      setMsg('Configuração guardada.');
    } catch (e: any) {
      setMsg(errorText(e, 'Não foi possível concluir.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.block}>
      <Text style={styles.blockTitle}>Modelo & key</Text>

      <Text style={styles.fieldLabel}>Fornecedor</Text>
      <View style={styles.chipRow} accessibilityRole="radiogroup" aria-label="Fornecedor">
        {providers.map((p) => {
          const active = p === provider;
          const isWired = wired.includes(p);
          return (
            <Pressable
              key={p}
              accessibilityRole="radio"
              aria-checked={active}
              onPress={() => setProvider(p as any)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {p}
                {!isWired ? ' ·' : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {!wired.includes(provider) && (
        <Text style={styles.warn}>
          Este fornecedor ainda não está ligado no código (llm.ts). As chamadas vão falhar até ser adicionado.
        </Text>
      )}

      <Text style={styles.fieldLabel}>Modelo</Text>
      <TextInput
        testID={`admin-ai-model-${row.purpose}`}
        value={modelId}
        onChangeText={setModelId}
        placeholder="gpt-4o-mini"
        placeholderTextColor={theme.colors.textTertiary as any}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.field}
      />

      <Text style={styles.fieldLabel}>Endereço do serviço (opcional)</Text>
      <TextInput
        value={endpoint}
        onChangeText={setEndpoint}
        placeholder="https://… (deixa vazio para usar o do fornecedor)"
        placeholderTextColor={theme.colors.textTertiary as any}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.field}
      />

      <View style={styles.keyHeaderRow}>
        <Text style={styles.fieldLabel}>Chave de API</Text>
        <Pressable onPress={() => setReveal((r) => !r)} accessibilityRole="button">
          <Text style={styles.link}>{reveal ? 'Esconder' : 'Mostrar'}</Text>
        </Pressable>
      </View>
      {reveal ? (
        <Text testID={`admin-ai-key-reveal-${row.purpose}`} style={styles.keyReveal}>
          {revealed === undefined ? 'a carregar…' : revealed ?? '(sem chave)'}
        </Text>
      ) : (
        <Text style={styles.muted}>{row.config?.apiKeyMasked ?? '(sem chave)'}</Text>
      )}
      <TextInput
        testID={`admin-ai-key-${row.purpose}`}
        value={keyEdit}
        onChangeText={setKeyEdit}
        placeholder="Nova chave (deixa vazio para manter a atual)"
        placeholderTextColor={theme.colors.textTertiary as any}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.field}
      />

      <Pressable
        testID={`admin-ai-save-config-${row.purpose}`}
        accessibilityRole="button"
        disabled={saving}
        onPress={save}
        style={[styles.btnBlock, saving ? styles.btnOff : styles.btnOn]}
      >
        {saving && <ActivityIndicator color={theme.colors.onInk} size="small" />}
        <Text style={[styles.btnText, saving && styles.btnTextOff]}>Guardar configuração</Text>
      </Pressable>
      {row.defaultModel && (
        <Text style={styles.muted}>Predefinido: {row.defaultModel}</Text>
      )}
      {msg && <Text style={msg === 'Configuração guardada.' ? styles.ok : styles.error}>{msg}</Text>}
    </View>
  );
}

function PromptEditor({
  row,
  availableTopics,
}: {
  row: PurposeRow;
  availableTopics: readonly string[];
}) {
  const { theme } = useUnistyles();
  const savePrompt = useMutation(api.ai.admin.savePrompt);
  const resetPrompt = useMutation(api.ai.admin.resetPromptToDefault);

  // 'default' = global prompt; otherwise a topic id.
  const [scope, setScope] = useState<'default' | TopicId>('default');
  const variant =
    scope === 'default'
      ? row.prompt
      : row.topicVariants.find((tv) => tv.topic === scope)?.prompt ?? null;

  const [systemPrompt, setSystemPrompt] = useState(variant?.systemPrompt ?? '');
  const [userTemplate, setUserTemplate] = useState(variant?.userTemplate ?? '');
  const [temperature, setTemperature] = useState(
    variant?.temperature != null ? String(variant.temperature) : ''
  );
  const [maxTokens, setMaxTokens] = useState(
    variant?.maxTokens != null ? String(variant.maxTokens) : ''
  );
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Re-load fields when the admin switches scope (default ↔ a topic).
  function selectScope(next: 'default' | TopicId) {
    setScope(next);
    setMsg(null);
    const v =
      next === 'default'
        ? row.prompt
        : row.topicVariants.find((tv) => tv.topic === next)?.prompt ?? null;
    setSystemPrompt(v?.systemPrompt ?? '');
    setUserTemplate(v?.userTemplate ?? '');
    setTemperature(v?.temperature != null ? String(v.temperature) : '');
    setMaxTokens(v?.maxTokens != null ? String(v.maxTokens) : '');
  }

  const topicArg = scope === 'default' ? undefined : scope;

  async function save() {
    setMsg(null);
    if (systemPrompt.trim().length === 0) {
      setMsg('As instruções de sistema não podem estar vazias.');
      return;
    }
    const temp = temperature.trim() === '' ? undefined : Number(temperature);
    const tok = maxTokens.trim() === '' ? undefined : Number(maxTokens);
    if (temp !== undefined && (!isFinite(temp) || temp < 0 || temp > 2)) {
      setMsg('Temperatura entre 0 e 2.');
      return;
    }
    if (tok !== undefined && (!Number.isInteger(tok) || tok <= 0)) {
      setMsg('O máximo de tokens deve ser um número inteiro positivo.');
      return;
    }
    setSaving(true);
    try {
      await savePrompt({
        purpose: row.purpose,
        topic: topicArg,
        systemPrompt,
        userTemplate: userTemplate.trim() || undefined,
        temperature: temp,
        maxTokens: tok,
      });
      setMsg('Instruções guardadas.');
    } catch (e: any) {
      setMsg(errorText(e, 'Não foi possível concluir.'));
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    setMsg(null);
    setResetting(true);
    try {
      await resetPrompt({ purpose: row.purpose, topic: topicArg });
      setMsg('Repostas as instruções predefinidas. Reabre o cartão para ver.');
    } catch (e: any) {
      setMsg(errorText(e, 'Não foi possível concluir.'));
    } finally {
      setResetting(false);
    }
  }

  const hasDefault =
    scope === 'default'
      ? row.hasDefaultPrompt
      : row.topicDefaults.includes(scope);

  return (
    <View style={styles.block}>
      <Text style={styles.blockTitle}>Instruções (prompt)</Text>

      <View style={styles.chipRow} accessibilityRole="radiogroup" aria-label="Âmbito do prompt">
        <Pressable
          accessibilityRole="radio"
          aria-checked={scope === 'default'}
          onPress={() => selectScope('default')}
          style={[styles.chip, scope === 'default' && styles.chipActive]}
        >
          <Text style={[styles.chipText, scope === 'default' && styles.chipTextActive]}>
            Geral
          </Text>
        </Pressable>
        {availableTopics.map((tp) => {
          const active = scope === tp;
          const has = row.topicVariants.some((tv) => tv.topic === tp);
          return (
            <Pressable
              key={tp}
              accessibilityRole="radio"
              aria-checked={active}
              onPress={() => selectScope(tp as TopicId)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {tp}
                {has ? '' : ' +'}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {scope !== 'default' && !variant && (
        <Text style={styles.muted}>
          Sem variante para este tema. Guarda para a criar; até lá, usa as instruções gerais.
        </Text>
      )}

      <Text style={styles.fieldLabel}>Instruções de sistema</Text>
      <TextInput
        testID={`admin-ai-system-${row.purpose}`}
        multiline
        value={systemPrompt}
        onChangeText={setSystemPrompt}
        placeholder="Instruções de sistema…"
        placeholderTextColor={theme.colors.textTertiary as any}
        style={styles.fieldTall}
      />

      <Text style={styles.fieldLabel}>Modelo da mensagem</Text>
      {row.meta.variables.length > 0 && (
        <View style={styles.chipRow}>
          {row.meta.variables.map((varName) => (
            <View key={varName} style={styles.varChip}>
              <Text style={styles.varChipText}>{`{{${varName}}}`}</Text>
            </View>
          ))}
        </View>
      )}
      <TextInput
        testID={`admin-ai-template-${row.purpose}`}
        multiline
        value={userTemplate}
        onChangeText={setUserTemplate}
        placeholder="Template com {{variáveis}}…"
        placeholderTextColor={theme.colors.textTertiary as any}
        style={styles.fieldTall}
      />

      <View style={styles.inputRow}>
        <View style={styles.half}>
          <Text style={styles.fieldLabel}>Temperatura</Text>
          <TextInput
            value={temperature}
            onChangeText={setTemperature}
            placeholder="0.2"
            placeholderTextColor={theme.colors.textTertiary as any}
            keyboardType="decimal-pad"
            style={styles.field}
          />
        </View>
        <View style={styles.half}>
          <Text style={styles.fieldLabel}>Máximo de tokens</Text>
          <TextInput
            value={maxTokens}
            onChangeText={setMaxTokens}
            placeholder="350"
            placeholderTextColor={theme.colors.textTertiary as any}
            keyboardType="number-pad"
            style={styles.field}
          />
        </View>
      </View>

      <View style={styles.inputRow}>
        <Pressable
          testID={`admin-ai-save-prompt-${row.purpose}`}
          accessibilityRole="button"
          disabled={saving}
          onPress={save}
          style={[styles.btnFlex, saving ? styles.btnOff : styles.btnOn]}
        >
          {saving && <ActivityIndicator color={theme.colors.onInk} size="small" />}
          <Text style={[styles.btnText, saving && styles.btnTextOff]}>Guardar instruções</Text>
        </Pressable>
        {hasDefault && (
          <Pressable
            accessibilityRole="button"
            disabled={resetting}
            onPress={reset}
            style={[styles.btnFlex, styles.btnGhost]}
          >
            {resetting && <ActivityIndicator color={theme.colors.inkText} size="small" />}
            <Text style={styles.btnGhostText}>Repor predefinição</Text>
          </Pressable>
        )}
      </View>
      {msg && (
        <Text style={msg.endsWith('guardadas.') || msg.startsWith('Repostas') ? styles.ok : styles.error}>
          {msg}
        </Text>
      )}
    </View>
  );
}

function TestRunner({ row }: { row: PurposeRow }) {
  const { theme } = useUnistyles();
  const testPurpose = useAction(api.ai.admin.testPurpose);

  const [vars, setVars] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    setOutput(null);
    // Fill any unset variables with empty strings so the template renderer
    // doesn't throw on a missing key the admin left blank.
    const full: Record<string, string> = {};
    for (const varName of row.meta.variables) full[varName] = vars[varName] ?? '';
    setRunning(true);
    try {
      const r = await testPurpose({ purpose: row.purpose, vars: full });
      setOutput(r.output);
    } catch (e: any) {
      setError(errorText(e, 'Não foi possível concluir.'));
    } finally {
      setRunning(false);
    }
  }

  return (
    <View style={styles.block}>
      <Text style={styles.blockTitle}>Teste rápido</Text>
      {row.meta.variables.map((varName) => (
        <View key={varName}>
          <Text style={styles.fieldLabel}>{`{{${varName}}}`}</Text>
          <TextInput
            multiline
            value={vars[varName] ?? ''}
            onChangeText={(t) => setVars((prev) => ({ ...prev, [varName]: t }))}
            placeholder={`valor para ${varName}…`}
            placeholderTextColor={theme.colors.textTertiary as any}
            style={styles.fieldMid}
          />
        </View>
      ))}
      <Pressable
        testID={`admin-ai-test-${row.purpose}`}
        accessibilityRole="button"
        disabled={running}
        onPress={run}
        style={[styles.btnBlock, running ? styles.btnOff : styles.btnOn]}
      >
        {running && <ActivityIndicator color={theme.colors.onInk} size="small" />}
        <Text style={[styles.btnText, running && styles.btnTextOff]}>
          {running ? 'A correr…' : 'Correr'}
        </Text>
      </Pressable>
      {error && <Text style={styles.error}>{error}</Text>}
      {output && (
        <View style={styles.resultBox}>
          <Text style={styles.resultText}>{output}</Text>
        </View>
      )}
    </View>
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
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
  sectionLabel: {
    fontFamily: fonts.displayBold,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: theme.colors.textTertiary,
    marginTop: theme.spacing.sm,
  },
  hint: { fontSize: 12, color: theme.colors.textSecondary },
  warn: { fontSize: 12, color: theme.colors.warning },
  muted: { fontSize: 12, color: theme.colors.textTertiary },
  link: { fontSize: 13, fontWeight: '600', color: theme.colors.inkText },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, flexWrap: 'wrap' },
  capValue: { fontFamily: fonts.displayBold, fontSize: 18, color: theme.colors.inkText },
  inputRow: { flexDirection: 'row', gap: theme.spacing.sm },
  half: { flex: 1 },

  pipelineBlock: {
    gap: 2,
    paddingTop: theme.spacing.sm,
    marginTop: theme.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
  },
  pipelineLabel: { fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary },
  diagRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  connector: { alignItems: 'center', height: 18, justifyContent: 'center' },
  connectorLine: { width: 2, height: 18, backgroundColor: theme.colors.textTertiary },
  node: {
    backgroundColor: theme.colors.surfaceSunken,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    alignItems: 'center',
    gap: 4,
    minWidth: 120,
    maxWidth: 170,
  },
  nodeDot: { width: 8, height: 8, borderRadius: 4 },
  nodeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  nodeModel: { fontSize: 10, color: theme.colors.textTertiary, textAlign: 'center' },

  purposeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  purposeHeaderText: { flex: 1, gap: 2 },
  purposeHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  chevron: { fontSize: 12, color: theme.colors.textTertiary },
  purposeBody: { gap: theme.spacing.md, marginTop: theme.spacing.sm },

  block: {
    gap: theme.spacing.xs,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
  },
  blockTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary },
  fieldLabel: { fontSize: 12, color: theme.colors.textSecondary, marginTop: theme.spacing.xs },

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
  fieldMid: {
    fontSize: 14,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surfaceSunken,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    padding: theme.spacing.sm,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  fieldTall: {
    fontSize: 13,
    fontFamily: 'monospace',
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surfaceSunken,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    padding: theme.spacing.sm,
    minHeight: 140,
    textAlignVertical: 'top',
  },
  keyHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  keyReveal: {
    fontSize: 13,
    fontFamily: 'monospace',
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surfaceSunken,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    padding: theme.spacing.sm,
  },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.pill,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surfaceSunken,
  },
  chipActive: { backgroundColor: theme.colors.ink },
  chipText: { fontSize: 12, color: theme.colors.textSecondary },
  chipTextActive: { color: theme.colors.onInk, fontWeight: '600' },
  varChip: {
    paddingVertical: 4,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.pill,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surfaceSunken,
  },
  varChipText: { fontSize: 11, fontFamily: 'monospace', color: theme.colors.textSecondary },

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
    marginTop: theme.spacing.xs,
  },
  btnFlex: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  btnOn: { backgroundColor: theme.colors.ink },
  btnOff: { backgroundColor: theme.colors.surfaceSunken },
  btnGhost: { backgroundColor: theme.colors.surfaceSunken },
  btnText: { fontSize: 14, fontWeight: '500', color: theme.colors.onInk },
  btnTextOff: { color: theme.colors.textTertiary },
  btnGhostText: { fontSize: 14, fontWeight: '500', color: theme.colors.inkText },
  ok: { fontSize: 14, color: theme.colors.success },
  error: { fontSize: 14, color: theme.colors.danger },
  resultBox: {
    backgroundColor: theme.colors.surfaceSunken,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    marginTop: theme.spacing.xs,
  },
  resultText: { fontSize: 14, color: theme.colors.textPrimary, lineHeight: 22 },
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
