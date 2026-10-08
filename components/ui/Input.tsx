import { useState } from 'react';
import { TextInput, View, Text, type TextInputProps, Platform } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

type Props = {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  error?: string;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  /**
   * Input purpose for autofill and assistive tech (WCAG 1.3.5). Defaults to
   * 'email' for email fields and 'current-password' for secure fields; pass
   * 'new-password' on sign-up forms.
   */
  autoComplete?: TextInputProps['autoComplete'];
  testID?: string;
  /** Several lines of text (grows from `minHeight`). */
  multiline?: boolean;
  minHeight?: number;
};

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  error,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  autoComplete,
  testID,
  multiline,
  minHeight,
}: Props) {
  const [focused, setFocused] = useState(false);
  styles.useVariants({ state: error ? 'error' : focused ? 'focused' : 'idle' });

  const resolvedAutoComplete =
    autoComplete ??
    (secureTextEntry
      ? 'current-password'
      : keyboardType === 'email-address'
        ? 'email'
        : undefined);

  return (
    <View style={styles.wrap}>
      {/* The input carries the label itself, so the visual label is hidden
          from screen readers to avoid reading it twice. */}
      <Text style={styles.label} aria-hidden>
        {label}
      </Text>
      <TextInput
        testID={testID}
        accessibilityLabel={label}
        // Read the error after the label so it is heard when the field is focused.
        accessibilityHint={error}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={styles.placeholderColor.color}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoComplete={resolvedAutoComplete}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : undefined}
        style={[styles.field, WEB_NO_OUTLINE, multiline && { minHeight: minHeight ?? 120, lineHeight: 22 }]}
      />
      {error ? (
        <Text
          testID={testID ? `${testID}-error` : undefined}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={styles.error}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

// Web only: drop the browser's default focus outline (an OS-colored ring, often
// orange); the focused state draws an ink border + soft glow instead. Kept out
// of the typed stylesheet because RN's outlineStyle type has no 'none'.
const WEB_NO_OUTLINE = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;

const styles = StyleSheet.create((theme) => ({
  wrap: { gap: theme.spacing.xs },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  field: {
    minHeight: 48,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surfaceSunken,
    borderWidth: 1.5,
    variants: {
      state: {
        idle: { borderColor: theme.colors.inputBorder },
        focused: { borderColor: theme.colors.inkText, boxShadow: `0 0 0 4px ${theme.colors.focusRing}` },
        error: { borderColor: theme.colors.danger },
      },
    },
  },
  error: { fontSize: 12, color: theme.colors.danger },
  placeholderColor: { color: theme.colors.textTertiary },
}));
