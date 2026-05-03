import { TextInput, View, Text } from 'react-native';
import { colors, spacing, radius, typography } from '@/constants/theme';

type Props = {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  error?: string;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
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
}: Props) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={{ ...typography.sm, fontWeight: '500', color: colors.text.secondary }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        style={{
          borderWidth: 1,
          borderColor: error ? colors.danger : colors.border,
          borderRadius: radius.md,
          padding: spacing.md,
          ...typography.base,
          color: colors.text.primary,
          backgroundColor: colors.background.primary,
        }}
      />
      {error ? (
        <Text style={{ ...typography.xs, color: colors.danger }}>{error}</Text>
      ) : null}
    </View>
  );
}
