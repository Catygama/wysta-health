import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useQuery, useMutation } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Icon } from '@/components/ui/Icon';
import { colors, spacing, typography, radius } from '@/constants/theme';

const AGE_RANGES = ['<18', '18-25', '26-35', '36-45', '46-55', '>55'];
const PREGNANCY_OPTIONS: { value: string; label: string }[] = [
  { value: 'not-pregnant', label: 'Não estou grávida' },
  { value: 'pregnant', label: 'Estou grávida' },
  { value: 'trying', label: 'Estou a tentar engravidar' },
  { value: 'postpartum', label: 'Pós-parto' },
  { value: 'prefer-not-to-say', label: 'Prefiro não dizer' },
];

const PREGNANCY_LABELS: Record<string, string> = Object.fromEntries(
  PREGNANCY_OPTIONS.map((o) => [o.value, o.label])
);

export default function Profile() {
  const { signOut } = useAuthActions();
  const user = useQuery(api.users.currentUser);
  const updateProfile = useMutation(api.users.updateProfile);

  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [pregnancyStatus, setPregnancyStatus] = useState('');
  const [location, setLocation] = useState('');
  const [conditionInput, setConditionInput] = useState('');
  const [conditions, setConditions] = useState<string[]>([]);
  const [medicationInput, setMedicationInput] = useState('');
  const [medications, setMedications] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.profile) return;
    setDisplayName(user.profile.displayName ?? '');
    setAgeRange(user.profile.ageRange ?? '');
    setPregnancyStatus(user.profile.pregnancyStatus ?? '');
    setLocation(user.profile.location ?? '');
    setConditions(user.profile.conditions ?? []);
    setMedications(user.profile.medications ?? []);
  }, [user?.profile]);

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
      <View
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
      >
        <ActivityIndicator color={colors.primary} />
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

  function confirmSignOut() {
    Alert.alert('Sair', 'Tens a certeza que queres terminar a sessão?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => signOut() },
    ]);
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
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text
          style={{
            ...typography['2xl'],
            fontWeight: '700',
            color: colors.text.primary,
          }}
        >
          O meu perfil
        </Text>
        {!editing && (
          <Pressable onPress={() => setEditing(true)} hitSlop={8}>
            <Text
              style={{
                ...typography.sm,
                color: colors.primary,
                fontWeight: '600',
              }}
            >
              Editar
            </Text>
          </Pressable>
        )}
      </View>

      <Card>
        <Row label="Email" value={user?.email ?? '—'} selectable />
      </Card>

      {editing ? (
        <View style={{ gap: spacing.lg }}>
          <Card>
            <Input
              label="Nome a apresentar (opcional)"
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="ex.: Maria"
              autoCapitalize="sentences"
            />
            <Input
              label="Localidade (opcional)"
              value={location}
              onChangeText={setLocation}
              placeholder="ex.: Lisboa"
              autoCapitalize="sentences"
            />
          </Card>

          <Card title="Faixa etária">
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: spacing.sm,
              }}
            >
              {AGE_RANGES.map((age) => (
                <SelectPill
                  key={age}
                  label={age}
                  active={ageRange === age}
                  onPress={() => setAgeRange(ageRange === age ? '' : age)}
                />
              ))}
            </View>
          </Card>

          <Card title="Estado de gravidez">
            <View style={{ gap: spacing.sm }}>
              {PREGNANCY_OPTIONS.map((opt) => (
                <SelectRow
                  key={opt.value}
                  label={opt.label}
                  active={pregnancyStatus === opt.value}
                  onPress={() =>
                    setPregnancyStatus(
                      pregnancyStatus === opt.value ? '' : opt.value
                    )
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

          <View style={{ gap: spacing.sm }}>
            <Button label="Guardar" onPress={save} loading={saving} />
            <Button
              label="Cancelar"
              variant="secondary"
              onPress={cancel}
            />
          </View>
        </View>
      ) : (
        <View style={{ gap: spacing.md }}>
          <Card title="Dados de saúde">
            <Row
              label="Nome"
              value={user?.profile?.displayName ?? '—'}
            />
            <Row
              label="Faixa etária"
              value={user?.profile?.ageRange ?? '—'}
            />
            <Row
              label="Estado de gravidez"
              value={
                PREGNANCY_LABELS[user?.profile?.pregnancyStatus ?? ''] ?? '—'
              }
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

      <View
        style={{
          backgroundColor: colors.primaryLight,
          borderRadius: radius.md,
          padding: spacing.md,
          gap: spacing.xs,
          flexDirection: 'row',
        }}
      >
        <Icon
          name={{ sf: 'lock.shield.fill', ion: 'lock-closed' }}
          size={20}
          color={colors.primary}
        />
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={{
              ...typography.sm,
              fontWeight: '700',
              color: colors.primary,
            }}
          >
            Privacidade dos dados
          </Text>
          <Text style={{ ...typography.xs, color: colors.text.secondary }}>
            A tua informação é tratada com confidencialidade. Apenas profissionais envolvidos no acompanhamento têm acesso aos dados clínicos.
          </Text>
        </View>
      </View>

      <View
        style={{
          backgroundColor: colors.background.secondary,
          borderRadius: radius.lg,
          padding: spacing.md,
          gap: spacing.md,
        }}
      >
        <Text
          style={{
            ...typography.sm,
            fontWeight: '600',
            color: colors.text.primary,
          }}
        >
          Gestão de conta
        </Text>
        <Pressable
          onPress={() =>
            Alert.alert(
              'Exportar dados',
              'Em breve poderás exportar uma cópia dos teus dados. Por agora contacta o suporte.'
            )
          }
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
        >
          <Icon
            name={{ sf: 'square.and.arrow.up', ion: 'cloud-download-outline' }}
            size={18}
            color={colors.primary}
          />
          <Text style={{ ...typography.sm, color: colors.primary, fontWeight: '600' }}>
            Exportar os meus dados
          </Text>
        </Pressable>
        <Pressable
          onPress={() =>
            Alert.alert(
              'Apagar conta',
              'A eliminação de conta requer confirmação manual. Contacta o suporte para procedermos.'
            )
          }
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
        >
          <Icon
            name={{ sf: 'trash', ion: 'trash-outline' }}
            size={18}
            color={colors.danger}
          />
          <Text style={{ ...typography.sm, color: colors.danger, fontWeight: '600' }}>
            Apagar conta
          </Text>
        </Pressable>
      </View>

      <Button label="Terminar sessão" variant="secondary" onPress={confirmSignOut} />
    </ScrollView>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: colors.background.secondary,
        borderRadius: radius.lg,
        padding: spacing.md,
        gap: spacing.sm,
      }}
    >
      {title && (
        <Text
          style={{
            ...typography.sm,
            fontWeight: '600',
            color: colors.text.primary,
          }}
        >
          {title}
        </Text>
      )}
      {children}
    </View>
  );
}

function Row({ label, value, selectable }: { label: string; value: string; selectable?: boolean }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ ...typography.xs, color: colors.text.secondary }}>
        {label}
      </Text>
      <Text
        style={{ ...typography.base, color: colors.text.primary }}
        selectable={selectable}
      >
        {value}
      </Text>
    </View>
  );
}

type SelectPillProps = { label: string; active: boolean; onPress: () => void };
function SelectPill({ label, active, onPress }: SelectPillProps) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radius.full,
        borderWidth: 1.5,
        borderColor: active ? colors.primary : colors.border,
        backgroundColor: active
          ? colors.primaryLight
          : colors.background.primary,
      }}
    >
      <Text
        style={{
          ...typography.sm,
          fontWeight: '500',
          color: active ? colors.primary : colors.text.secondary,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

type SelectRowProps = { label: string; active: boolean; onPress: () => void };
function SelectRow({ label, active, onPress }: SelectRowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        padding: spacing.md,
        borderRadius: radius.md,
        borderWidth: 1.5,
        borderColor: active ? colors.primary : colors.border,
        backgroundColor: active
          ? colors.primaryLight
          : colors.background.primary,
      }}
    >
      <Text
        style={{
          ...typography.base,
          color: active ? colors.primary : colors.text.primary,
        }}
      >
        {label}
      </Text>
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

function TagEditor({
  value,
  onChangeText,
  tags,
  onAdd,
  onRemove,
  placeholder,
}: TagEditorProps) {
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.text.tertiary as any}
          onSubmitEditing={onAdd}
          returnKeyType="done"
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.md,
            padding: spacing.sm,
            ...typography.base,
            color: colors.text.primary,
            backgroundColor: colors.background.primary,
          }}
        />
        <Pressable
          onPress={onAdd}
          disabled={!value.trim()}
          style={{
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            borderRadius: radius.md,
            backgroundColor: value.trim() ? colors.primary : colors.border,
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>＋</Text>
        </Pressable>
      </View>
      {tags.length > 0 && (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.xs,
          }}
        >
          {tags.map((tag) => (
            <Pressable
              key={tag}
              onPress={() => onRemove(tag)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: colors.primaryLight,
                paddingVertical: 4,
                paddingHorizontal: spacing.sm,
                borderRadius: radius.full,
              }}
            >
              <Text
                style={{
                  ...typography.xs,
                  fontWeight: '600',
                  color: colors.primary,
                }}
              >
                {tag}
              </Text>
              <Icon
                name={{ sf: 'xmark', ion: 'close' }}
                size={10}
                color={colors.primary}
              />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function TagList({ tags }: { tags: string[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
      {tags.map((tag) => (
        <View
          key={tag}
          style={{
            backgroundColor: colors.primaryLight,
            paddingVertical: 4,
            paddingHorizontal: spacing.sm,
            borderRadius: radius.full,
          }}
        >
          <Text
            style={{
              ...typography.xs,
              fontWeight: '600',
              color: colors.primary,
            }}
          >
            {tag}
          </Text>
        </View>
      ))}
    </View>
  );
}
