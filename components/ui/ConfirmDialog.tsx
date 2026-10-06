import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Button } from '@/components/ui/Button';
import { fonts } from '@/lib/fonts';

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Single-button notice (no cancel); closing still calls onCancel. */
  hideCancel?: boolean;
  onConfirm: () => Promise<unknown> | void;
  onCancel: () => void;
  testID?: string;
};

// Cross-platform confirmation dialog (Alert.alert is a no-op on web). With
// hideCancel it doubles as a one-button notice. The confirm button always uses
// the brand (primary) color; danger red is reserved for clinical urgency.
// Stays open while onConfirm runs and shows its error if it throws.
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancelar',
  hideCancel,
  onConfirm,
  onCancel,
  testID,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setError(null);
    setBusy(true);
    try {
      await onConfirm();
    } catch (e: any) {
      setError(e?.message ?? 'Não foi possível concluir.');
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    if (busy) return;
    setError(null);
    onCancel();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={cancel}>
      <View style={styles.backdrop}>
        <Pressable style={styles.dismiss} onPress={cancel} accessibilityLabel={cancelLabel} />
        <View testID={testID} style={styles.dialog} accessibilityRole="alert">
          <Text style={styles.title}>{title}</Text>
          {message && <Text style={styles.message}>{message}</Text>}
          {error && <Text style={styles.error}>{error}</Text>}
          <View style={styles.actions}>
            {!hideCancel && (
              <View style={styles.action}>
                <Button
                  testID={testID ? `${testID}-cancel` : undefined}
                  label={cancelLabel}
                  kind="secondary"
                  onPress={cancel}
                  disabled={busy}
                />
              </View>
            )}
            <View style={styles.action}>
              <Button
                testID={testID ? `${testID}-confirm` : undefined}
                label={confirmLabel}
                kind="primary"
                onPress={confirm}
                loading={busy}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create((theme) => ({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  dismiss: { ...StyleSheet.absoluteFillObject },
  dialog: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  title: { fontFamily: fonts.displayBold, fontSize: 18, color: theme.colors.textPrimary },
  message: { fontSize: 15, color: theme.colors.textSecondary },
  error: { fontSize: 13, color: theme.colors.danger },
  actions: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  action: { flex: 1 },
}));
