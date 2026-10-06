import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import { useRouter } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Icon } from '@/components/ui/Icon';
import { WellbeingTrend } from '@/components/WellbeingTrend';
import { HistoryLink } from '@/components/HistoryLink';
import { AcademicNotice } from '@/components/AcademicNotice';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useTheme, type ThemeMode } from '@/lib/theme';
import { fonts } from '@/lib/fonts';
import { PREGNANCY_OPTIONS } from '@/constants/profile';

const AGE_RANGES = ['<18', '18-25', '26-35', '36-45', '46-55', '>55'];

const PREGNANCY_LABELS: Record<string, string> = Object.fromEntries(
  PREGNANCY_OPTIONS.map((o) => [o.value, o.label])
);

export default function Profile() {
  const router = useRouter();
  const { signOut } = useAuthActions();
  const user = useQuery(api.users.currentUser);
  const updateProfile = useMutation(api.users.updateProfile);
  const { theme } = useUnistyles();

  const [editing, setEditing] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [pregnancyStatus, setPregnancyStatus] = useState('');
  const [location, setLocation] = useState('');
  const [conditionInput, setConditionInput] = useState('');
  const [conditions, setConditions] = useState<string[]>([]);
  const [medicationInput, setMedicationInput] = useState('');
  const [medications, setMedications] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setDisplayName(user?.profile?.displayName ?? '');
    setAgeRange(user?.profile?.ageRange ?? '');
    setPregnancyStatus(user?.profile?.pregnancyStatus ?? '');
    setLocation(user?.profile?.location ?? '');
    setConditions(user?.profile?.conditions ?? []);
    setMedications(user?.profile?.medications ?? []);
    setConditionInput('');
    setMedicationInput('');
  }

  function cancel() {
    resetForm();
    setEditing(false);
  }

  if (user === undefined) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={theme.colors.inkText} />
      </View>
    );
  }

  async function save() {
    setSaving(true);
    try {
      await updateProfile({
        displayName: displayName.trim() || undefined,
        ageRange: ageRange || undefined,
        pregnancyStatus: pregnancyStatus || undefined,
        location: location.trim() || undefined,
        conditions: conditions.length ? conditions : undefined,
        medications: medications.length ? medications : undefined,
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }


  function addTag(value: string, list: string[], setList: (v: string[]) => void) {
    const v = value.trim();
    if (!v) return;
    if (list.includes(v)) return;
    setList([...list, v]);
  }

  function removeTag(value: string, list: string[], setList: (v: string[]) => void) {
    setList(list.filter((x) => x !== value));
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={styles.title}>O meu perfil</Text>
        {!editing && (
          <Pressable
            testID="profile-edit-button"
            // Load the saved profile into the form when editing starts.
            onPress={() => {
              resetForm();
              setEditing(true);
            }}
            hitSlop={8}
          >
            <Text style={styles.editLink}>Editar</Text>
          </Pressable>
        )}
      </View>

      <Card>
        <Row label="Email" value={user?.email ?? '—'} selectable />
      </Card>

      <HistoryLink onPress={() => router.push('/(patient)/profile/history')} />

      <WellbeingTrend />

      {editing ? (
        <View style={styles.group}>
          <Card>
            <Input
              testID="profile-name-input"
              label="Nome a apresentar (opcional)"
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="ex.: Maria"
              autoCapitalize="sentences"
            />
            <Input
              testID="profile-location-input"
              label="Localidade (opcional)"
              value={location}
              onChangeText={setLocation}
              placeholder="ex.: Lisboa"
              autoCapitalize="sentences"
            />
          </Card>

          <Card title="Faixa etária">
            <View style={styles.pillRow}>
              {AGE_RANGES.map((age) => (
                <SelectPill
                  key={age}
                  testID={`profile-age-${age}`}
                  label={age}
                  active={ageRange === age}
                  onPress={() => setAgeRange(ageRange === age ? '' : age)}
                />
              ))}
            </View>
          </Card>

          <Card title="Estado de gravidez">
            <View style={styles.optionList}>
              {PREGNANCY_OPTIONS.map((opt) => (
                <SelectRow
                  key={opt.value}
                  testID={`profile-pregnancy-${opt.value}`}
                  label={opt.label}
                  active={pregnancyStatus === opt.value}
                  onPress={() =>
                    setPregnancyStatus(pregnancyStatus === opt.value ? '' : opt.value)
                  }
                />
              ))}
            </View>
          </Card>

          <Card title="Condições de saúde (opcional)">
            <TagEditor
              value={conditionInput}
              onChangeText={setConditionInput}
              tags={conditions}
              onAdd={() => {
                addTag(conditionInput, conditions, setConditions);
                setConditionInput('');
              }}
              onRemove={(t) => removeTag(t, conditions, setConditions)}
              placeholder="Adicionar condição"
            />
          </Card>

          <Card title="Medicação atual (opcional)">
            <TagEditor
              value={medicationInput}
              onChangeText={setMedicationInput}
              tags={medications}
              onAdd={() => {
                addTag(medicationInput, medications, setMedications);
                setMedicationInput('');
              }}
              onRemove={(t) => removeTag(t, medications, setMedications)}
              placeholder="Adicionar medicação"
            />
          </Card>

          <View style={styles.actions}>
            <Button testID="profile-save-button" label="Guardar" onPress={save} loading={saving} />
            <Button
              testID="profile-cancel-button"
              label="Cancelar"
              variant="secondary"
              onPress={cancel}
            />
          </View>
        </View>
      ) : (
        <View style={styles.group}>
          <Card title="Dados de saúde">
            <Row label="Nome" value={user?.profile?.displayName ?? '—'} />
            <Row label="Faixa etária" value={user?.profile?.ageRange ?? '—'} />
            <Row
              label="Estado de gravidez"
              value={PREGNANCY_LABELS[user?.profile?.pregnancyStatus ?? ''] ?? '—'}
            />
            <Row label="Localidade" value={user?.profile?.location ?? '—'} />
          </Card>

          {(user?.profile?.conditions?.length ?? 0) > 0 && (
            <Card title="Condições">
              <TagList tags={user?.profile?.conditions ?? []} />
            </Card>
          )}

          {(user?.profile?.medications?.length ?? 0) > 0 && (
            <Card title="Medicação">
              <TagList tags={user?.profile?.medications ?? []} />
            </Card>
          )}
        </View>
      )}

      <ThemeCard />

      <View style={styles.privacy}>
        <Icon name={{ sf: 'lock.shield.fill', ion: 'lock-closed' }} size={20} color={theme.colors.inkText} />
        <View style={styles.privacyBody}>
          <Text style={styles.privacyTitle}>Privacidade dos dados</Text>
          <Text style={styles.privacyText}>
            A tua informação é tratada com confidencialidade. Apenas profissionais
            envolvidos no acompanhamento têm acesso aos dados clínicos.
          </Text>
        </View>
      </View>

      <View style={styles.manageCard}>
        <Text style={styles.manageTitle}>Gestão de conta</Text>
        <Pressable
          onPress={() =>
            setNotice({
              title: 'Exportar dados',
              message:
                'Em breve poderás exportar uma cópia dos teus dados. Por agora contacta o suporte.',
            })
          }
          style={styles.manageRow}
        >
          <Icon name={{ sf: 'square.and.arrow.up', ion: 'cloud-download-outline' }} size={18} color={theme.colors.inkText} />
          <Text style={styles.manageLink}>Exportar os meus dados</Text>
        </Pressable>
        <Pressable
          onPress={() =>
            setNotice({
              title: 'Apagar conta',
              message:
                'A eliminação de conta requer confirmação manual. Contacta o suporte para procedermos.',
            })
          }
          style={styles.manageRow}
        >
          <Icon name={{ sf: 'trash', ion: 'trash-outline' }} size={18} color={theme.colors.danger} />
          <Text style={styles.manageDanger}>Apagar conta</Text>
        </Pressable>
      </View>

      <BootstrapAdminCard />

      <Button
        testID="profile-logout-button"
        label="Terminar sessão"
        variant="primary"
        onPress={() => setConfirmSignOut(true)}
      />

      {/* Alert.alert is a no-op on web, so confirmations/notices use ConfirmDialog. */}
      <ConfirmDialog
        testID="signout-dialog"
        visible={confirmSignOut}
        title="Terminar sessão?"
        message="Tens a certeza que queres terminar a sessão?"
        confirmLabel="Sair"
        onCancel={() => setConfirmSignOut(false)}
        onConfirm={async () => {
          await signOut();
          setConfirmSignOut(false);
        }}
      />
      <ConfirmDialog
        visible={notice !== null}
        title={notice?.title ?? ''}
        message={notice?.message}
        confirmLabel="Entendi"
        hideCancel
        onCancel={() => setNotice(null)}
        onConfirm={() => setNotice(null)}
      />

      <AcademicNotice />
    </ScrollView>
  );
}

const THEME_OPTIONS: { value: ThemeMode; label: string; description: string }[] = [
  { value: 'system', label: 'Sistema', description: 'Segue o tema do dispositivo' },
  { value: 'light', label: 'Claro', description: 'Forçar tema claro' },
  { value: 'dark', label: 'Escuro', description: 'Forçar tema escuro' },
];

function ThemeCard() {
  const { mode, setMode } = useTheme();
  return (
    <Card title="Tema">
      <View style={styles.optionList}>
        {THEME_OPTIONS.map((opt) => {
          const active = mode === opt.value;
          return (
            <Pressable
              key={opt.value}
              testID={`theme-mode-${opt.value}`}
              onPress={() => setMode(opt.value)}
              style={[styles.themeOption, active ? styles.selOn : styles.selOff]}
            >
              <Text style={[styles.themeLabel, active ? styles.selTextOn : styles.selTextOff]}>
                {opt.label}
              </Text>
              <Text style={[styles.themeDesc, active ? styles.themeDescOn : styles.themeDescOff]}>
                {opt.description}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

function BootstrapAdminCard() {
  const hasAdmin = useQuery(api.users.hasAnyAdmin);
  const bootstrap = useMutation(api.users.bootstrapAdmin);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (hasAdmin !== false) return null;

  async function promote() {
    setError('');
    setLoading(true);
    try {
      await bootstrap();
    } catch (e: any) {
      setError(e?.message ?? 'Falhou.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.bootstrap}>
      <Text style={styles.bootstrapTitle}>Bootstrap (sem admin)</Text>
      <Text style={styles.bootstrapText}>
        Ainda não existe administrador nesta plataforma. Podes promover esta conta
        para teres acesso ao painel de administração e ao seed de conteúdos.
      </Text>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <Button
        testID="profile-bootstrap-admin-button"
        label="Tornar-me administrador"
        variant="secondary"
        onPress={promote}
        loading={loading}
      />
    </View>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      {title && <Text style={styles.cardTitle}>{title}</Text>}
      {children}
    </View>
  );
}

function Row({ label, value, selectable }: { label: string; value: string; selectable?: boolean }) {
  return (
    <View style={styles.rowItem}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} selectable={selectable}>{value}</Text>
    </View>
  );
}

type SelectPillProps = { label: string; active: boolean; onPress: () => void; testID?: string };
function SelectPill({ label, active, onPress, testID }: SelectPillProps) {
  return (
    <Pressable testID={testID} onPress={onPress} style={[styles.selPill, active ? styles.selOn : styles.selOffSunken]}>
      <Text style={[styles.selPillText, active ? styles.selTextOn : styles.selTextOff]}>{label}</Text>
    </Pressable>
  );
}

type SelectRowProps = { label: string; active: boolean; onPress: () => void; testID?: string };
function SelectRow({ label, active, onPress, testID }: SelectRowProps) {
  return (
    <Pressable testID={testID} onPress={onPress} style={[styles.selRow, active ? styles.selOn : styles.selOffSunken]}>
      <Text style={[styles.selRowText, active ? styles.selTextOn : styles.selRowTextOff]}>{label}</Text>
    </Pressable>
  );
}

type TagEditorProps = {
  value: string;
  onChangeText: (v: string) => void;
  tags: string[];
  onAdd: () => void;
  onRemove: (tag: string) => void;
  placeholder: string;
};

function TagEditor({ value, onChangeText, tags, onAdd, onRemove, placeholder }: TagEditorProps) {
  const { theme } = useUnistyles();
  return (
    <View style={styles.tagEditor}>
      <View style={styles.tagInputRow}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textTertiary as any}
          onSubmitEditing={onAdd}
          returnKeyType="done"
          style={styles.tagInput}
        />
        <Pressable
          onPress={onAdd}
          disabled={!value.trim()}
          style={[styles.tagAdd, value.trim() ? styles.tagAddOn : styles.tagAddOff]}
        >
          <Text style={styles.tagAddText}>＋</Text>
        </Pressable>
      </View>
      {tags.length > 0 && (
        <View style={styles.tagWrap}>
          {tags.map((tag) => (
            <Pressable key={tag} onPress={() => onRemove(tag)} style={styles.tagChip}>
              <Text style={styles.tagChipText}>{tag}</Text>
              <Icon name={{ sf: 'xmark', ion: 'close' }} size={10} color={theme.colors.inkText} />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function TagList({ tags }: { tags: string[] }) {
  return (
    <View style={styles.tagWrap}>
      {tags.map((tag) => (
        <View key={tag} style={styles.tagChip}>
          <Text style={styles.tagChipText}>{tag}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background },
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, gap: theme.spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: fonts.displayExtraBold, fontSize: 26, color: theme.colors.inkText },
  editLink: { fontSize: 14, color: theme.colors.accent, fontWeight: '500' },
  group: { gap: theme.spacing.lg },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  cardTitle: { fontFamily: fonts.displayBold, fontSize: 16, color: theme.colors.textPrimary },
  rowItem: { gap: 2 },
  rowLabel: { fontSize: 12, color: theme.colors.textSecondary },
  rowValue: { fontSize: 16, color: theme.colors.textPrimary },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  optionList: { gap: theme.spacing.sm },
  actions: { gap: theme.spacing.sm },
  selOn: { backgroundColor: theme.colors.ink },
  selOff: { backgroundColor: theme.colors.surface },
  selOffSunken: { backgroundColor: theme.colors.surfaceSunken },
  selTextOn: { color: theme.colors.onInk },
  selTextOff: { color: theme.colors.textSecondary },
  selPill: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.pill,
    borderCurve: 'continuous',
  },
  selPillText: { fontSize: 14, fontWeight: '500' },
  selRow: { padding: theme.spacing.md, borderRadius: theme.radius.md, borderCurve: 'continuous' },
  selRowText: { fontSize: 16 },
  selRowTextOff: { color: theme.colors.textPrimary },
  themeOption: { padding: theme.spacing.md, borderRadius: theme.radius.md, borderCurve: 'continuous', gap: 2 },
  themeLabel: { fontSize: 16, fontWeight: '500' },
  themeDesc: { fontSize: 12 },
  themeDescOn: { color: theme.colors.onInk, opacity: 0.85 },
  themeDescOff: { color: theme.colors.textSecondary },
  privacy: {
    backgroundColor: theme.colors.surfaceSunken,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    flexDirection: 'row',
  },
  privacyBody: { flex: 1, gap: 2 },
  privacyTitle: { fontSize: 14, fontWeight: '500', color: theme.colors.inkText },
  privacyText: { fontSize: 12, color: theme.colors.textSecondary },
  manageCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  manageTitle: { fontFamily: fonts.displayBold, fontSize: 14, color: theme.colors.textPrimary },
  manageRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  manageLink: { fontSize: 14, color: theme.colors.inkText, fontWeight: '500' },
  manageDanger: { fontSize: 14, color: theme.colors.danger, fontWeight: '500' },
  bootstrap: {
    backgroundColor: theme.colors.warningSurface,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  bootstrapTitle: { fontFamily: fonts.displayBold, fontSize: 14, color: theme.colors.warning },
  bootstrapText: { fontSize: 12, color: theme.colors.textSecondary },
  errorText: { fontSize: 12, color: theme.colors.danger },
  tagEditor: { gap: theme.spacing.sm },
  tagInputRow: { flexDirection: 'row', gap: theme.spacing.sm },
  tagInput: {
    flex: 1,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    padding: theme.spacing.sm,
    fontSize: 16,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surfaceSunken,
  },
  tagAdd: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    justifyContent: 'center',
  },
  tagAddOn: { backgroundColor: theme.colors.ink },
  tagAddOff: { backgroundColor: theme.colors.surfaceSunken },
  tagAddText: { color: theme.colors.onInk, fontWeight: '500' },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.butter,
    paddingVertical: 4,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.pill,
  },
  tagChipText: { fontSize: 12, fontWeight: '500', color: theme.colors.inkText },
}));
