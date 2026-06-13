import { useState } from 'react';
import { TextInput, View, Text } from 'react-native';
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
  testID?: string;
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
  testID,
}: Props) {
  const [focused, setFocused] = useState(false);
  styles.useVariants({ state: error ? 'error' : focused ? 'focused' : 'idle' });

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={styles.placeholderColor.color}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={styles.field}
      />
      {error ? (
        <Text
          testID={testID ? `${testID}-error` : undefined}
          style={styles.error}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  wrap: { gap: theme.spacing.xs },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  field: {
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surfaceSunken,
    borderWidth: 2,
    variants: {
      state: {
        idle: { borderColor: 'transparent' },
        focused: { borderColor: theme.colors.accent },
        error: { borderColor: theme.colors.danger },
      },
    },
  },
  error: { fontSize: 12, color: theme.colors.danger },
  placeholderColor: { color: theme.colors.textTertiary },
}));
