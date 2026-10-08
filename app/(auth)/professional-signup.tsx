import { useState } from 'react';
import { View, Text, ScrollView, Pressable, Image, ActivityIndicator } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useAuthActions } from '@convex-dev/auth/react';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { api } from '@/convex/_generated/api';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { strings } from '@/constants/strings';
import { fonts } from '@/lib/fonts';
import { pickImage, uploadImage, type PickedImage } from '@/lib/upload';
import { guestAuthEnabled } from '@/lib/env';
import { withAuthRetry } from '@/lib/authRetry';
import { errorText } from '@/lib/errorText';

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
  const { isAuthenticated } = useConvexAuth();
  // The guest professional only exists where the deployment allows it.
  const guestProfessionalEnabled = useQuery(api.users.guestProfessionalEnabled) === true;
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
            d.picked.uri === picked.uri ? { ...d, storageId, uploading: false } : d
          )
        );
      }
    } catch (e: any) {
      setError(errorText(e, 'Não foi possível anexar o documento.'));
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
        ...otherDocs.map((d) => d.storageId).filter((id): id is string => Boolean(id)),
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
    } catch (e: any) {
      setError(errorText(e, strings.errors.generic));
    } finally {
      setLoading(false);
    }
  }

  async function handleGuest() {
    setError('');
    setGuestLoading(true);
    try {
      await signIn('anonymous-professional');
    } catch (e: any) {
      setError(errorText(e, 'Não foi possível entrar em modo de demonstração. Tenta de novo.'));
    } finally {
      setGuestLoading(false);
    }
  }


  // Navigate once the session is actually active: redirecting right after
  // signIn() resolves races the auth state and bounces back to login.
  if (isAuthenticated && !loading && !guestLoading) return <Redirect href="/" />;
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.head}>
        <View style={styles.headRow}>
          <View style={styles.logo}>
            <Icon name={{ sf: 'stethoscope', ion: 'medkit' }} size={22} color={styles.onInk.color} />
          </View>
          <Text style={styles.title}>Pedido de verificação</Text>
        </View>
        <Text style={styles.subtitle}>
          Cria a conta e envia os documentos. A equipa Wysta valida a tua cédula antes
          do acesso clínico.
        </Text>
      </View>

      <Section title="1. Conta">
        <Input
          testID="prof-signup-email-input"
          label={strings.auth.email}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="email@instituicao.pt"
        />
        <Input
          testID="prof-signup-password-input"
          label={strings.auth.password}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
        />
        <Input
          testID="prof-signup-password-confirm-input"
          label={strings.auth.confirmPassword}
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          autoComplete="new-password"
        />
      </Section>

      <Section title="2. Identificação">
        <Input
          testID="prof-signup-name-input"
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
          testID="prof-signup-license-input"
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
        <Text style={styles.hint}>
          Comprovativo de inscrição na Ordem, certificado da entidade empregadora, ou
          outros documentos relevantes.
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
          style={({ pressed }) => [styles.dashed, pressed && styles.dim]}
        >
          <Icon name={{ sf: 'plus.circle', ion: 'add-circle-outline' }} size={18} color={styles.ink.color} />
          <Text style={styles.dashedText}>Adicionar documento</Text>
        </Pressable>
      </Section>

      <Section title="5. Notas (opcional)">
        <Input
          testID="prof-signup-notes-input"
          label="Mensagem para a equipa de verificação"
          value={notes}
          onChangeText={setNotes}
          placeholder="Ex.: instituição, contexto adicional..."
          autoCapitalize="sentences"
        />
      </Section>

      {error ? (
        <Text testID="prof-signup-error" style={styles.error}>{error}</Text>
      ) : null}

      <View style={styles.submitGroup}>
        <Button
          testID="prof-signup-submit-button"
          label="Submeter pedido"
          onPress={handleSubmit}
          loading={loading}
        />
        <Text style={styles.fineprint}>
          A conta fica pendente até a Wysta validar a documentação.
        </Text>
      </View>

      {guestAuthEnabled && guestProfessionalEnabled && (
        <View style={styles.guest}>
          <Divider label="testes internos" />
          <Button
            testID="prof-signup-guest-button"
            strongBorder
            label="Entrar como enfermeiro convidado"
            variant="secondary"
            onPress={handleGuest}
            loading={guestLoading}
          />
          <Text style={styles.fineprint}>
            Modo de teste — sem cédula real, conta auto-verificada.
          </Text>
        </View>
      )}

      <Pressable
        onPress={() => router.replace('/(auth)/professional-login')}
        style={styles.back}
        hitSlop={8}
      >
        <Text style={styles.backText}>← Já tenho conta de enfermeiro</Text>
      </Pressable>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function SpecialtyPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.specWrap}>
      <Text style={styles.specLabel}>Especialidade</Text>
      <View style={styles.specChips}>
        {SPECIALTIES.map((opt) => {
          const active = value === opt;
          return (
            <Pressable
              key={opt}
              testID={`prof-signup-specialty-${opt.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}`}
              onPress={() => onChange(opt)}
              style={[styles.specChip, active ? styles.specChipOn : styles.specChipOff]}
            >
              <Text style={[styles.specChipText, active ? styles.onInk : styles.specChipTextOff]}>
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
  const { theme } = useUnistyles();
  if (!doc) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.docEmpty, pressed && styles.dim]}>
        <Icon name={{ sf: 'doc.badge.plus', ion: 'document-attach' }} size={20} color={theme.colors.inkText} />
        <Text style={styles.docEmptyLabel}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
        <Text style={styles.docEmptyHint}>Toca para escolher imagem</Text>
      </Pressable>
    );
  }
  return (
    <View style={styles.docFilled}>
      <Image source={{ uri: doc.picked.uri }} style={styles.docThumb} resizeMode="cover" />
      <View style={styles.docMeta}>
        <Text style={styles.docName} numberOfLines={1}>{label}</Text>
        <Text style={[styles.docStatus, { color: doc.uploading ? theme.colors.warning : theme.colors.success }]}>
          {doc.uploading ? 'A enviar...' : 'Enviado ✓'}
        </Text>
      </View>
      {doc.uploading ? (
        <ActivityIndicator color={theme.colors.inkText} size="small" />
      ) : (
        <Pressable onPress={onRemove} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remover ${doc.picked.fileName ?? "documento"}`}>
          <Icon name={{ sf: 'xmark.circle.fill', ion: 'close-circle' }} size={22} color={theme.colors.textTertiary} />
        </Pressable>
      )}
    </View>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <View style={styles.divider}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerLabel}>{label}</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, gap: theme.spacing.xl },
  ink: { color: theme.colors.inkText },
  onInk: { color: theme.colors.onInk },
  head: { gap: theme.spacing.sm },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: fonts.displayExtraBold, fontSize: 22, color: theme.colors.inkText },
  subtitle: { fontSize: 14, color: theme.colors.textSecondary },
  section: { gap: theme.spacing.sm },
  sectionTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 13,
    color: theme.colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionBody: { gap: theme.spacing.md },
  hint: { fontSize: 12, color: theme.colors.textSecondary },
  dashed: {
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: theme.colors.divider,
    padding: theme.spacing.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.surface,
  },
  dashedText: { fontSize: 14, color: theme.colors.inkText, fontWeight: '500' },
  dim: { opacity: 0.7 },
  error: { fontSize: 14, color: theme.colors.danger },
  submitGroup: { gap: theme.spacing.sm },
  fineprint: { fontSize: 12, color: theme.colors.textTertiary, textAlign: 'center' },
  guest: { gap: theme.spacing.sm, marginTop: theme.spacing.md },
  back: { paddingVertical: theme.spacing.sm },
  backText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center' },
  specWrap: { gap: theme.spacing.sm },
  specLabel: { fontSize: 14, fontWeight: '500', color: theme.colors.textSecondary },
  specChips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs },
  specChip: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.pill,
    borderCurve: 'continuous',
  },
  specChipOn: { backgroundColor: theme.colors.ink },
  specChipOff: { backgroundColor: theme.colors.surface },
  specChipText: { fontSize: 14, fontWeight: '500' },
  specChipTextOff: { color: theme.colors.textSecondary },
  docEmpty: {
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: theme.colors.accent,
    padding: theme.spacing.md,
    alignItems: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.surface,
  },
  docEmptyLabel: { fontSize: 14, fontWeight: '500', color: theme.colors.inkText },
  required: { color: theme.colors.danger },
  docEmptyHint: { fontSize: 12, color: theme.colors.textTertiary },
  docFilled: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surface,
  },
  docThumb: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceSunken,
  },
  docMeta: { flex: 1, gap: 2 },
  docName: { fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },
  docStatus: { fontSize: 12 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  dividerLine: { flex: 1, height: 1, backgroundColor: theme.colors.divider },
  dividerLabel: { fontSize: 12, color: theme.colors.textTertiary },
}));
