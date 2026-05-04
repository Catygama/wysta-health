import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthActions } from '@convex-dev/auth/react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { colors, spacing, typography, radius } from '@/constants/theme';
import { strings } from '@/constants/strings';
import { pickImage, uploadImage, type PickedImage } from '@/lib/upload';
import { guestAuthEnabled } from '@/lib/env';
import { withAuthRetry } from '@/lib/authRetry';

const SPECIALTIES = [
  'Medicina Geral e Familiar',
  'Ginecologia / Obstetrícia',
  'Enfermagem de Saúde Materna',
  'Enfermagem de Saúde Comunitária',
  'Outra',
];

type Doc = { picked: PickedImage; storageId?: string; uploading: boolean };

export default function ProfessionalSignup() {
  const { signIn } = useAuthActions();
  const generateUploadUrl = useMutation(api.users.generateUploadUrl);
  const submit = useMutation(api.users.submitProfessionalVerification);
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [licenseDoc, setLicenseDoc] = useState<Doc | null>(null);
  const [otherDocs, setOtherDocs] = useState<Doc[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [error, setError] = useState('');

  async function pickAndUpload(target: 'license' | 'other') {
    setError('');
    try {
      const picked = await pickImage();
      if (!picked) return;
      if (target === 'license') {
        setLicenseDoc({ picked, uploading: true });
      } else {
        setOtherDocs((prev) => [...prev, { picked, uploading: true }]);
      }
      const url = await generateUploadUrl();
      const storageId = await uploadImage(url, picked);
      if (target === 'license') {
        setLicenseDoc({ picked, storageId, uploading: false });
      } else {
        setOtherDocs((prev) =>
          prev.map((d) =>
            d.picked.uri === picked.uri
              ? { ...d, storageId, uploading: false }
              : d
          )
        );
      }
    } catch (e: any) {
      setError(e?.message ?? 'Erro a anexar documento.');
      if (target === 'license') setLicenseDoc(null);
    }
  }

  function removeOtherDoc(uri: string) {
    setOtherDocs((prev) => prev.filter((d) => d.picked.uri !== uri));
  }

  async function handleSubmit() {
    setError('');
    if (password !== confirm) {
      setError(strings.errors.passwordMismatch);
      return;
    }
    if (!licenseDoc?.storageId) {
      setError('Anexa uma imagem da cédula profissional.');
      return;
    }
    if (!licenseNumber.trim() || !specialty.trim()) {
      setError('Cédula e especialidade são obrigatórias.');
      return;
    }
    if (otherDocs.some((d) => d.uploading)) {
      setError('Aguarda o upload dos documentos terminar.');
      return;
    }
    setLoading(true);
    try {
      await signIn('password', { email, password, flow: 'signUp' });
      const docIds = [
        licenseDoc.storageId,
        ...otherDocs
          .map((d) => d.storageId)
          .filter((id): id is string => Boolean(id)),
      ];
      await withAuthRetry(() =>
        submit({
          displayName: displayName.trim() || undefined,
          professionalLicenseNumber: licenseNumber.trim(),
          professionalSpecialty: specialty.trim(),
          professionalVerificationDocuments: docIds as any,
          professionalVerificationNotes: notes.trim() || undefined,
        })
      );
      router.replace('/');
    } catch (e: any) {
      setError(e?.message ?? strings.errors.generic);
    } finally {
      setLoading(false);
    }
  }

  async function handleGuest() {
    setError('');
    setGuestLoading(true);
    try {
      // Profile is created server-side by afterUserCreatedOrUpdated.
      await signIn('anonymous-professional');
      router.replace('/');
    } catch (e: any) {
      const message = e?.message ?? String(e);
      setError(`Guest professional falhou: ${message}`);
    } finally {
      setGuestLoading(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={{
        padding: spacing.lg,
        gap: spacing.xl,
        backgroundColor: colors.background.primary,
      }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ gap: spacing.sm }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
          }}
        >
          <Icon
            name={{ sf: 'stethoscope', ion: 'medkit' }}
            size={26}
            color={colors.primary}
          />
          <Text
            style={{
              ...typography.xl,
              fontWeight: '700',
              color: colors.text.primary,
            }}
          >
            Pedido de verificação
          </Text>
        </View>
        <Text style={{ ...typography.sm, color: colors.text.secondary }}>
          Cria a conta e envia os documentos. A equipa Wysta valida a tua cédula antes do acesso clínico.
        </Text>
      </View>

      <Section title="1. Conta">
        <Input
          label={strings.auth.email}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="email@instituicao.pt"
        />
        <Input
          label={strings.auth.password}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <Input
          label={strings.auth.confirmPassword}
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
        />
      </Section>

      <Section title="2. Identificação">
        <Input
          label="Nome a apresentar"
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
          placeholder="Dr.ª Maria Silva"
        />
        <SpecialtyPicker value={specialty} onChange={setSpecialty} />
      </Section>

      <Section title="3. Cédula profissional">
        <Input
          label="Número da cédula"
          value={licenseNumber}
          onChangeText={setLicenseNumber}
          autoCapitalize="characters"
          placeholder="Ex.: 123456 (Ordem dos Médicos)"
        />
        <DocSlot
          label="Imagem da cédula"
          required
          doc={licenseDoc}
          onPress={() => pickAndUpload('license')}
          onRemove={() => setLicenseDoc(null)}
        />
      </Section>

      <Section title="4. Documentos adicionais (opcional)">
        <Text style={{ ...typography.xs, color: colors.text.secondary }}>
          Comprovativo de inscrição na Ordem, certificado da entidade empregadora, ou outros documentos relevantes.
        </Text>
        {otherDocs.map((doc) => (
          <DocSlot
            key={doc.picked.uri}
            label={doc.picked.fileName ?? 'Documento'}
            doc={doc}
            onPress={() => pickAndUpload('other')}
            onRemove={() => removeOtherDoc(doc.picked.uri)}
          />
        ))}
        <Pressable
          onPress={() => pickAndUpload('other')}
          style={({ pressed }) => ({
            borderRadius: radius.md,
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: colors.border,
            padding: spacing.md,
            alignItems: 'center',
            backgroundColor: pressed
              ? colors.background.tertiary
              : colors.background.primary,
            flexDirection: 'row',
            justifyContent: 'center',
            gap: spacing.xs,
          })}
        >
          <Icon
            name={{ sf: 'plus.circle', ion: 'add-circle-outline' }}
            size={18}
            color={colors.primary}
          />
          <Text
            style={{
              ...typography.sm,
              color: colors.primary,
              fontWeight: '600',
            }}
          >
            Adicionar documento
          </Text>
        </Pressable>
      </Section>

      <Section title="5. Notas (opcional)">
        <Input
          label="Mensagem para a equipa de verificação"
          value={notes}
          onChangeText={setNotes}
          placeholder="Ex.: instituição, contexto adicional..."
          autoCapitalize="sentences"
        />
      </Section>

      {error ? (
        <Text style={{ ...typography.sm, color: colors.danger }}>{error}</Text>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <Button
          label="Submeter pedido"
          onPress={handleSubmit}
          loading={loading}
        />
        <Text
          style={{
            ...typography.xs,
            color: colors.text.tertiary,
            textAlign: 'center',
          }}
        >
          A conta fica pendente até a Wysta validar a documentação.
        </Text>
      </View>

      {guestAuthEnabled && (
        <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
          <Divider label="testes internos" />
          <Button
            label="Entrar como profissional convidado"
            variant="secondary"
            onPress={handleGuest}
            loading={guestLoading}
          />
          <Text
            style={{
              ...typography.xs,
              color: colors.text.tertiary,
              textAlign: 'center',
            }}
          >
            Modo de teste — sem cédula real, conta auto-verificada.
          </Text>
        </View>
      )}

      <Pressable
        onPress={() => router.replace('/(auth)/professional-login')}
        style={{ paddingVertical: spacing.sm }}
        hitSlop={8}
      >
        <Text
          style={{
            ...typography.sm,
            color: colors.text.secondary,
            textAlign: 'center',
          }}
        >
          ← Já tenho conta profissional
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text
        style={{
          ...typography.sm,
          fontWeight: '700',
          color: colors.text.primary,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {title}
      </Text>
      <View style={{ gap: spacing.md }}>{children}</View>
    </View>
  );
}

function SpecialtyPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text
        style={{
          ...typography.sm,
          fontWeight: '500',
          color: colors.text.secondary,
        }}
      >
        Especialidade
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        {SPECIALTIES.map((opt) => {
          const active = value === opt;
          return (
            <Pressable
              key={opt}
              onPress={() => onChange(opt)}
              style={{
                paddingVertical: spacing.xs,
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
                {opt}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

type DocSlotProps = {
  label: string;
  doc: Doc | null;
  required?: boolean;
  onPress: () => void;
  onRemove: () => void;
};

function DocSlot({ label, doc, required, onPress, onRemove }: DocSlotProps) {
  if (!doc) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          borderRadius: radius.md,
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderColor: required ? colors.primary : colors.border,
          padding: spacing.md,
          alignItems: 'center',
          gap: spacing.xs,
          backgroundColor: pressed
            ? colors.background.tertiary
            : colors.background.primary,
        })}
      >
        <Icon
          name={{ sf: 'doc.badge.plus', ion: 'document-attach' }}
          size={20}
          color={colors.primary}
        />
        <Text
          style={{
            ...typography.sm,
            fontWeight: '600',
            color: colors.primary,
          }}
        >
          {label}
          {required && <Text style={{ color: colors.danger }}> *</Text>}
        </Text>
        <Text
          style={{
            ...typography.xs,
            color: colors.text.tertiary,
          }}
        >
          Toca para escolher imagem
        </Text>
      </Pressable>
    );
  }
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        padding: spacing.sm,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: doc.uploading ? colors.warning : colors.success,
        backgroundColor: colors.background.primary,
      }}
    >
      <Image
        source={{ uri: doc.picked.uri }}
        style={{
          width: 48,
          height: 48,
          borderRadius: radius.sm,
          backgroundColor: colors.background.tertiary,
        }}
        resizeMode="cover"
      />
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{
            ...typography.sm,
            fontWeight: '600',
            color: colors.text.primary,
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
        <Text style={{ ...typography.xs, color: colors.text.secondary }}>
          {doc.uploading ? 'A enviar...' : 'Enviado ✓'}
        </Text>
      </View>
      {doc.uploading ? (
        <ActivityIndicator color={colors.primary} size="small" />
      ) : (
        <Pressable onPress={onRemove} hitSlop={8}>
          <Icon
            name={{ sf: 'xmark.circle.fill', ion: 'close-circle' }}
            size={22}
            color={colors.text.tertiary}
          />
        </Pressable>
      )}
    </View>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
      }}
    >
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      <Text style={{ ...typography.xs, color: colors.text.tertiary }}>
        {label}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
    </View>
  );
}
