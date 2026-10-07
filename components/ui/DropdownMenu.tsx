import { useRef, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '@/components/ui/Icon';

export type DropdownOption<T extends string> = {
  label: string;
  value: T;
  /** Optional colour dot next to the option (e.g. priority). */
  dotColor?: string;
};

type Props<T extends string> = {
  /** Text shown on the trigger, e.g. "Prioridade: todas". */
  label: string;
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  testID?: string;
};

// Quiet text trigger ("Mais antigo ▾") that opens a small menu under it.
// Uses a transparent Modal so a tap anywhere outside closes it, on web and native.
export function DropdownMenu<T extends string>({ label, value, options, onChange, testID }: Props<T>) {
  const { theme } = useUnistyles();
  const triggerRef = useRef<View>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);

  const open = () => {
    triggerRef.current?.measureInWindow((x, y, _w, h) => setAnchor({ x, y: y + h + 4 }));
  };
  const close = () => setAnchor(null);

  return (
    <>
      <Pressable
        ref={triggerRef}
        testID={testID}
        accessibilityRole="button"
        accessibilityState={{ expanded: !!anchor }}
        hitSlop={8}
        onPress={open}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
      >
        <Text style={styles.triggerText}>{label}</Text>
        <Icon name={{ sf: 'chevron.down', ion: 'chevron-down' }} size={14} color={theme.colors.inkText} />
      </Pressable>

      <Modal visible={!!anchor} transparent animationType="none" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Fechar menu">
          {anchor && (
            <View style={[styles.menu, { top: anchor.y, left: anchor.x }]}>
              {options.map((o) => {
                const selected = o.value === value;
                return (
                  <Pressable
                    key={o.value}
                    testID={testID ? `${testID}-${o.value}` : undefined}
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      onChange(o.value);
                      close();
                    }}
                    style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                      styles.item,
                      (pressed || hovered) && styles.itemHover,
                    ]}
                  >
                    {o.dotColor ? (
                      <View style={[styles.dot, { backgroundColor: o.dotColor }]} />
                    ) : null}
                    <Text style={[styles.itemText, selected && styles.itemTextOn]}>{o.label}</Text>
                    {selected ? (
                      <Icon name={{ sf: 'checkmark', ion: 'checkmark' }} size={16} color={theme.colors.inkText} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          )}
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create((theme) => ({
  trigger: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: theme.spacing.xs },
  pressed: { opacity: 0.6 },
  triggerText: { fontSize: 14, fontWeight: '600', color: theme.colors.inkText },
  backdrop: { flex: 1 },
  menu: {
    position: 'absolute',
    minWidth: 180,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    boxShadow: '0 8px 24px rgba(80, 0, 13, 0.12)',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.md,
  },
  itemHover: { backgroundColor: theme.colors.surfaceSunken },
  // Outlined so pale pastel colours still read on the white menu.
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: theme.colors.border },
  itemText: { flex: 1, fontSize: 15, color: theme.colors.textPrimary },
  itemTextOn: { fontWeight: '600', color: theme.colors.inkText },
}));
