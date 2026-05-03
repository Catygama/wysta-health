import { useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/Button';
import { ESCALATION_LEVEL_LABELS } from '@/constants/conversation';
import { colors, spacing, typography, radius } from '@/constants/theme';

type Level = 'routine' | 'urgent' | 'same-day' | 'emergency';

const LEVELS: Level[] = ['routine', 'urgent', 'same-day', 'emergency'];

type Props = {
  visible: boolean;
  conversationId: string;
  onClose: () => void;
};

export function EscalateSheet({ visible, conversationId, onClose }: Props) {
  const escalate = useMutation(api.conversations.escalate);
  const [level, setLevel] = useState<Level | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!level || !notes.trim()) return;
    setError('');
    setLoading(true);
    try {
      await escalate({ id: conversationId as any, level, notes: notes.trim() });
      setLevel(null);
      setNotes('');
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao escalar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}
        onPress={onClose}
      >
        <Pressable
          style={{
            marginTop: 'auto',
            backgroundColor: colors.background.primary,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            padding: spacing.lg,
            gap: spacing.md,
            maxHeight: '90%',
            ...(Platform.OS === 'web' ? { width: '100%', maxWidth: 480, alignSelf: 'center' } : {}),
          }}
          onPress={(e) => e.stopPropagation()}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.borderOpaque,
            }}
          />
          <Text
            style={{
              ...typography.xl,
              fontWeight: '700',
              color: colors.text.primary,
            }}
          >
            Escalar conversa
          </Text>
          <Text style={{ ...typography.sm, color: colors.text.secondary }}>
            A escalada altera a prioridade para urgente e regista a ação no histórico clínico.
          </Text>

          <ScrollView
            contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.md }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={{ gap: spacing.sm }}>
              <Text
                style={{
                  ...typography.sm,
                  fontWeight: '600',
                  color: colors.text.primary,
                }}
              >
                Nível de escalamento
              </Text>
              {LEVELS.map((l) => {
                const selected = level === l;
                return (
                  <Pressable
                    key={l}
                    onPress={() => setLevel(l)}
                    style={{
                      padding: spacing.md,
                      borderRadius: radius.md,
                      borderWidth: 1.5,
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected
                        ? colors.primaryLight
                        : colors.background.primary,
                    }}
                  >
                    <Text
                      style={{
                        ...typography.base,
                        fontWeight: '600',
                        color: selected ? colors.primary : colors.text.primary,
                      }}
                    >
                      {ESCALATION_LEVEL_LABELS[l]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ gap: spacing.xs }}>
              <Text
                style={{
                  ...typography.sm,
                  fontWeight: '600',
                  color: colors.text.primary,
                }}
              >
                Notas e recomendações
              </Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Descreve o motivo do escalamento..."
                placeholderTextColor={colors.text.tertiary as any}
                multiline
                numberOfLines={4}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  ...typography.base,
                  color: colors.text.primary,
                  backgroundColor: colors.background.primary,
                  minHeight: 100,
                  textAlignVertical: 'top',
                }}
              />
            </View>

            {error ? (
              <Text style={{ ...typography.sm, color: colors.danger }}>
                {error}
              </Text>
            ) : null}

            <Button
              label="Escalar conversa"
              variant="danger"
              onPress={submit}
              loading={loading}
              disabled={!level || !notes.trim()}
            />
            <Button label="Cancelar" variant="secondary" onPress={onClose} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
