import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View, Platform } from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { api } from '@/convex/_generated/api';
import type { TopicId } from '@/convex/lib/topics';
import { ALERT_LEVELS, type AlertLevel } from '@/convex/lib/alerts';
import { ALERT_LABELS } from '@/constants/triageAlerts';
import { TOPICS } from '@/constants/topics';
import { AlertLevelBadge } from '@/components/AlertLevelBadge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DropdownMenu } from '@/components/ui/DropdownMenu';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { fonts } from '@/lib/fonts';
import { errorText } from '@/lib/errorText';

type QuestionType = 'yes-no' | 'multiple-choice' | 'scale' | 'text';
type Question = {
  id: string;
  question: string;
  type: QuestionType;
  options?: string[];
  alert?: { level: AlertLevel; minScale?: number; equals?: string[] };
  required: boolean;
  showIf?: { questionId: string; equals: string[] };
};

const TYPE_LABELS: Record<QuestionType, string> = {
  'yes-no': 'Sim / Não',
  'multiple-choice': 'Escolha múltipla',
  scale: 'Escala',
  text: 'Texto livre',
};

const YES_NO_LABELS: Record<string, string> = { yes: 'Sim', no: 'Não' };

const newId = () => `q-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// Stored questions may carry fields the editor no longer uses (isRedFlag).
function clean(q: Question & { isRedFlag?: boolean }): Question {
  const { isRedFlag: _old, ...rest } = q;
  return rest;
}

function answersOf(q: Question): string[] {
  if (q.type === 'yes-no') return ['yes', 'no'];
  if (q.type === 'text') return [];
  return q.options ?? [];
}

const answerLabel = (a: string) => YES_NO_LABELS[a] ?? a;

function scaleBounds(q: Question): [number, number] {
  const nums = (q.options ?? []).map(Number).filter((n) => Number.isFinite(n));
  return nums.length ? [Math.min(...nums), Math.max(...nums)] : [1, 10];
}

const range = (min: number, max: number) =>
  Array.from({ length: Math.max(0, max - min + 1) }, (_, i) => String(min + i));

// Conteúdos → Triagem: the admin edits, orders, adds and removes the triage
// questions of a topic, with the alert each answer triggers.
export function TriageEditor() {
  const [topic, setTopic] = useState<TopicId>(TOPICS[0].id as TopicId);
  const data = useQuery(api.triage.adminGet, { topic });
  const saveQuestions = useMutation(api.triage.saveQuestions);
  const { theme } = useUnistyles();

  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [dirty, setDirty] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  // Load the topic's questions (again after a save) unless there are edits.
  useEffect(() => {
    if (data !== undefined && !dirty) {
      setQuestions((data?.questions ?? []).map(clean));
    }
  }, [data, dirty]);

  const topicLabel = TOPICS.find((t) => t.id === topic)?.label ?? topic;

  function update(next: Question[]) {
    setQuestions(next);
    setDirty(true);
    setMessage(null);
  }

  function patch(id: string, change: Partial<Question>) {
    if (!questions) return;
    update(questions.map((q) => (q.id === id ? { ...q, ...change } : q)));
  }

  function move(index: number, by: -1 | 1) {
    if (!questions) return;
    const target = index + by;
    if (target < 0 || target >= questions.length) return;
    const next = questions.slice();
    [next[index], next[target]] = [next[target], next[index]];
    update(next);
  }

  function remove(id: string) {
    if (!questions) return;
    // Questions shown only after this one's answer are now always shown.
    update(
      questions
        .filter((q) => q.id !== id)
        .map((q) => (q.showIf?.questionId === id ? { ...q, showIf: undefined } : q))
    );
    if (open === id) setOpen(null);
  }

  // Renaming an option keeps the alert and "show if" rules that used it.
  function renameOption(id: string, index: number, value: string) {
    if (!questions) return;
    const q = questions.find((x) => x.id === id);
    if (!q?.options) return;
    const old = q.options[index];
    const swap = (list?: string[]) => list?.map((e) => (e === old ? value : e));
    update(
      questions.map((x) => {
        if (x.id === id) {
          const options = q.options!.map((o, i) => (i === index ? value : o));
          return { ...x, options, alert: x.alert && { ...x.alert, equals: swap(x.alert.equals) } };
        }
        if (x.showIf?.questionId === id) return { ...x, showIf: { ...x.showIf, equals: swap(x.showIf.equals)! } };
        return x;
      })
    );
  }

  function add() {
    if (!questions) return;
    const q: Question = { id: newId(), question: '', type: 'yes-no', required: true };
    update([...questions, q]);
    setOpen(q.id);
  }

  async function save() {
    if (!questions) return;
    setSaving(true);
    setMessage(null);
    try {
      await saveQuestions({ topic, questions });
      setDirty(false);
      setOpen(null);
      setMessage({ kind: 'ok', text: 'Triagem guardada. As novas triagens já usam estas perguntas.' });
    } catch (e: any) {
      setMessage({ kind: 'error', text: errorText(e, 'Não foi possível guardar.') });
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    setDirty(false);
    setOpen(null);
    setMessage(null);
    setQuestions((data?.questions ?? []).map(clean));
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.toolbar}>
        <DropdownMenu
          testID="triage-topic"
          label={`Tema: ${topicLabel}`}
          value={topic}
          onChange={(t) => {
            if (dirty) {
              setMessage({ kind: 'error', text: 'Guarda ou descarta as alterações antes de mudar de tema.' });
              return;
            }
            setTopic(t);
            setQuestions(null);
            setOpen(null);
            setMessage(null);
          }}
          options={TOPICS.map((t) => ({ value: t.id as TopicId, label: t.label }))}
        />
        <Button testID="triage-add" size="sm" label="Nova pergunta" onPress={add} disabled={!questions} />
      </View>

      <Text style={styles.note}>
        As alterações valem só para as triagens novas; as conversas que já existem mantêm as respostas que tinham.
      </Text>

      {questions === null ? null : questions.length === 0 ? (
        <Text style={styles.note}>Este tema ainda não tem perguntas.</Text>
      ) : (
        questions.map((q, i) => {
          const parent = q.showIf && questions.find((x) => x.id === q.showIf!.questionId);
          const isOpen = open === q.id;
          return (
            <View key={q.id} testID={`triage-question-${i + 1}`} style={[styles.card, isOpen && styles.cardOpen]}>
              <View style={styles.cardTop}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Editar pergunta ${i + 1}`}
                  onPress={() => setOpen(isOpen ? null : q.id)}
                  style={styles.cardHead}
                >
                  <View style={styles.num}>
                    <Text style={styles.numText}>{i + 1}</Text>
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.qText}>{q.question || 'Pergunta sem texto'}</Text>
                    <Text style={styles.qMeta}>
                      {TYPE_LABELS[q.type]}
                      {q.type === 'multiple-choice' && q.options ? ` · ${q.options.length} opções` : ''}
                      {q.type === 'scale' ? ` · ${scaleBounds(q).join(' a ')}` : ''}
                      {q.required ? '' : ' · opcional'}
                      {parent
                        ? ` · só se "${parent.question.slice(0, 40)}${parent.question.length > 40 ? '…' : ''}" = ${q.showIf!.equals.map(answerLabel).join(' ou ')}`
                        : ''}
                    </Text>
                    {q.alert ? (
                      <View style={styles.alertRow}>
                        <AlertLevelBadge level={q.alert.level} />
                        <Text style={styles.qMeta}>
                          {q.type === 'yes-no'
                            ? 'se "Sim"'
                            : q.type === 'scale'
                              ? `a partir de ${q.alert.minScale}`
                              : `se ${(q.alert.equals ?? []).map((e) => `"${e}"`).join(' ou ')}`}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
                <View style={styles.tools}>
                  <IconButton label="Subir" icon={{ sf: 'arrow.up', ion: 'arrow-up' }} disabled={i === 0} onPress={() => move(i, -1)} />
                  <IconButton
                    label="Descer"
                    icon={{ sf: 'arrow.down', ion: 'arrow-down' }}
                    disabled={i === questions.length - 1}
                    onPress={() => move(i, 1)}
                  />
                  <IconButton label="Apagar" icon={{ sf: 'trash', ion: 'trash-outline' }} onPress={() => setToDelete(q.id)} />
                </View>
              </View>

              {isOpen && (
                <QuestionForm
                  q={q}
                  earlier={questions.slice(0, i).filter((x) => x.type !== 'text')}
                  onChange={(change) => patch(q.id, change)}
                  onRenameOption={(index, value) => renameOption(q.id, index, value)}
                  onClose={() => setOpen(null)}
                />
              )}
            </View>
          );
        })
      )}

      {message && (
        <Text
          testID="triage-message"
          accessibilityLiveRegion="polite"
          style={[styles.message, message.kind === 'error' && { color: theme.colors.danger }]}
        >
          {message.text}
        </Text>
      )}

      <View style={styles.actions}>
        <Button testID="triage-save" label="Guardar alterações" onPress={save} loading={saving} disabled={!dirty || saving} />
        {dirty && <Button testID="triage-discard" kind="secondary" label="Descartar" onPress={discard} disabled={saving} />}
      </View>

      <ConfirmDialog
        testID="triage-delete-dialog"
        visible={toDelete !== null}
        title="Apagar esta pergunta?"
        message="Só deixa de aparecer depois de guardares as alterações."
        confirmLabel="Apagar"
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) remove(toDelete);
          setToDelete(null);
        }}
      />
    </View>
  );
}

function QuestionForm({
  q,
  earlier,
  onChange,
  onRenameOption,
  onClose,
}: {
  q: Question;
  earlier: Question[];
  onChange: (change: Partial<Question>) => void;
  onRenameOption: (index: number, value: string) => void;
  onClose: () => void;
}) {
  const { theme } = useUnistyles();
  const [min, max] = scaleBounds(q);
  const parent = q.showIf && earlier.find((x) => x.id === q.showIf!.questionId);

  function setType(type: QuestionType) {
    if (type === q.type) return;
    const options =
      type === 'multiple-choice' ? ['', ''] : type === 'scale' ? range(1, 10) : undefined;
    const alert =
      !q.alert || type === 'text'
        ? undefined
        : type === 'scale'
          ? { level: q.alert.level, minScale: 8 }
          : type === 'multiple-choice'
            ? { level: q.alert.level, equals: [] }
            : { level: q.alert.level };
    onChange({ type, options, alert });
  }

  function setAlertLevel(level: AlertLevel | 'none') {
    if (level === 'none') return onChange({ alert: undefined });
    if (q.type === 'scale') return onChange({ alert: { level, minScale: q.alert?.minScale ?? max } });
    if (q.type === 'multiple-choice') return onChange({ alert: { level, equals: q.alert?.equals ?? [] } });
    onChange({ alert: { level } });
  }

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((x) => x !== value) : [...list, value];

  return (
    <View style={styles.form}>
      <Input
        testID="triage-q-text"
        label="Pergunta"
        value={q.question}
        onChangeText={(question) => onChange({ question })}
        multiline
        minHeight={64}
      />

      <View style={styles.formRow}>
        <View style={styles.field}>
          <Text style={styles.label}>Tipo de resposta</Text>
          <DropdownMenu
            testID="triage-q-type"
            label={TYPE_LABELS[q.type]}
            value={q.type}
            onChange={setType}
            options={(Object.keys(TYPE_LABELS) as QuestionType[]).map((t) => ({ value: t, label: TYPE_LABELS[t] }))}
          />
        </View>
        <View style={[styles.field, styles.switchField]}>
          <Text style={styles.label}>Obrigatória</Text>
          <Toggle label="Obrigatória" value={q.required} onChange={(required) => onChange({ required })} />
        </View>
      </View>

      {q.type === 'multiple-choice' && (
        <View style={styles.field}>
          <Text style={styles.label}>Opções</Text>
          {(q.options ?? []).map((o, i) => (
            <View key={i} style={styles.optionRow}>
              <TextInput
                accessibilityLabel={`Opção ${i + 1}`}
                value={o}
                onChangeText={(v) => onRenameOption(i, v)}
                placeholder={`Opção ${i + 1}`}
                placeholderTextColor={theme.colors.textTertiary as any}
                style={styles.smallInput}
              />
              <IconButton
                label={`Remover opção ${i + 1}`}
                icon={{ sf: 'xmark', ion: 'close' }}
                disabled={(q.options ?? []).length <= 2}
                onPress={() => {
                  const removed = q.options![i];
                  onChange({
                    options: q.options!.filter((_, j) => j !== i),
                    alert: q.alert && { ...q.alert, equals: q.alert.equals?.filter((e) => e !== removed) },
                  });
                }}
              />
            </View>
          ))}
          <Pressable
            accessibilityRole="button"
            onPress={() => onChange({ options: [...(q.options ?? []), ''] })}
            style={styles.linkBtn}
          >
            <Text style={styles.linkText}>+ Opção</Text>
          </Pressable>
        </View>
      )}

      {q.type === 'scale' && (
        <View style={styles.formRow}>
          <NumberField label="De" value={min} onChange={(n) => onChange({ options: range(n, Math.max(n + 1, max)) })} />
          <NumberField label="Até" value={max} onChange={(n) => onChange({ options: range(Math.min(min, n - 1), n) })} />
        </View>
      )}

      <View style={styles.field}>
        <Text style={styles.label}>Alerta</Text>
        {q.type === 'text' ? (
          <Text style={styles.note}>Perguntas de texto livre não dão alerta.</Text>
        ) : (
          <>
            <DropdownMenu
              testID="triage-q-alert"
              label={q.alert ? ALERT_LABELS[q.alert.level] : 'Sem alerta'}
              value={q.alert?.level ?? 'none'}
              onChange={setAlertLevel}
              options={[
                { value: 'none' as const, label: 'Sem alerta' },
                ...ALERT_LEVELS.map((l) => ({ value: l, label: ALERT_LABELS[l] })),
              ]}
            />
            {q.alert && q.type === 'yes-no' && <Text style={styles.note}>Dá alerta quando a resposta é "Sim".</Text>}
            {q.alert && q.type === 'scale' && (
              <NumberField
                label="A partir de"
                value={q.alert.minScale ?? max}
                onChange={(n) => onChange({ alert: { ...q.alert!, minScale: Math.min(max, Math.max(min, n)) } })}
              />
            )}
            {q.alert && q.type === 'multiple-choice' && (
              <>
                <Text style={styles.note}>Dá alerta quando a resposta é:</Text>
                <View style={styles.chips}>
                  {(q.options ?? []).filter(Boolean).map((o) => (
                    <Chip
                      key={o}
                      label={o}
                      on={q.alert!.equals?.includes(o) ?? false}
                      onPress={() => onChange({ alert: { ...q.alert!, equals: toggle(q.alert!.equals ?? [], o) } })}
                    />
                  ))}
                </View>
              </>
            )}
          </>
        )}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Mostrar</Text>
        <DropdownMenu
          testID="triage-q-showif"
          label={parent ? `Só se: ${parent.question.slice(0, 50)}${parent.question.length > 50 ? '…' : ''}` : 'Sempre'}
          value={q.showIf?.questionId ?? 'always'}
          onChange={(questionId) =>
            onChange({ showIf: questionId === 'always' ? undefined : { questionId, equals: [] } })
          }
          options={[
            { value: 'always', label: 'Sempre' },
            ...earlier.map((x, i) => ({ value: x.id, label: `Só se: ${x.question || `pergunta ${i + 1}`}` })),
          ]}
        />
        {parent && (
          <>
            <Text style={styles.note}>…a resposta for:</Text>
            <View style={styles.chips}>
              {answersOf(parent)
                .filter(Boolean)
                .map((a) => (
                  <Chip
                    key={a}
                    label={answerLabel(a)}
                    on={q.showIf!.equals.includes(a)}
                    onPress={() => onChange({ showIf: { ...q.showIf!, equals: toggle(q.showIf!.equals, a) } })}
                  />
                ))}
            </View>
          </>
        )}
      </View>

      <View style={styles.actions}>
        <Button kind="secondary" size="sm" label="Fechar" onPress={onClose} />
      </View>
    </View>
  );
}

// On/off switch whose knob has an outline, so it stays visible on the light
// pink track in the dark theme (the native Switch knob can't have a border).
function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      hitSlop={6}
      onPress={() => onChange(!value)}
      style={[styles.toggle, value && styles.toggleOn]}
    >
      <View style={[styles.toggleKnob, value && styles.toggleKnobOn]} />
    </Pressable>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={text}
        keyboardType="number-pad"
        onChangeText={(t) => {
          setText(t);
          const n = parseInt(t, 10);
          if (Number.isFinite(n)) onChange(n);
        }}
        style={[styles.smallInput, styles.numberInput]}
      />
    </View>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      aria-checked={on}
      onPress={onPress}
      style={[styles.chip, on && styles.chipOn]}
    >
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

function IconButton({
  label,
  icon,
  onPress,
  disabled,
}: {
  label: string;
  icon: IconName;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { theme } = useUnistyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }, disabled && { opacity: 0.3 }]}
    >
      <Icon name={icon} size={16} color={theme.colors.textSecondary} />
    </Pressable>
  );
}

const WEB_NO_OUTLINE = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;

const styles = StyleSheet.create((theme) => ({
  wrap: { gap: theme.spacing.sm },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.md },
  note: { fontSize: 13, color: theme.colors.textSecondary },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  cardOpen: { borderColor: theme.colors.borderStrong },
  cardTop: { flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'flex-start' },
  cardHead: { flex: 1, flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'flex-start' },
  num: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numText: { fontSize: 12, fontWeight: '700', color: theme.colors.inkText },
  cardBody: { flex: 1, gap: 4 },
  qText: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary },
  qMeta: { fontSize: 13, color: theme.colors.textSecondary },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, flexWrap: 'wrap' },
  tools: { flexDirection: 'row', gap: 2 },
  iconBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  form: {
    gap: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
    paddingTop: theme.spacing.md,
  },
  formRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.lg, alignItems: 'flex-start' },
  field: { gap: theme.spacing.xs },
  switchField: { alignItems: 'flex-start' },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    padding: 2,
    justifyContent: 'center',
    backgroundColor: theme.colors.border,
  },
  toggleOn: { backgroundColor: theme.colors.ink },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.textSecondary,
  },
  toggleKnobOn: { alignSelf: 'flex-end' },
  label: { fontSize: 14, fontWeight: '500', color: theme.colors.textSecondary },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
  smallInput: {
    flex: 1,
    minHeight: 40,
    borderRadius: theme.radius.sm,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceSunken,
    paddingHorizontal: theme.spacing.sm,
    fontSize: 15,
    color: theme.colors.textPrimary,
    ...(WEB_NO_OUTLINE as object),
  },
  numberInput: { flex: 0, width: 80 },
  linkBtn: { alignSelf: 'flex-start', paddingVertical: theme.spacing.xs },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.inkText },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  chipOn: { backgroundColor: theme.colors.ink, borderColor: theme.colors.ink },
  chipText: { fontSize: 13, color: theme.colors.textPrimary },
  chipTextOn: { color: theme.colors.onInk, fontWeight: '600' },
  message: { fontSize: 14, color: theme.colors.success },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
}));
