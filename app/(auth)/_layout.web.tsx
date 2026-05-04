import { Slot } from 'expo-router';
import { View, Text } from 'react-native';
import { colors, spacing, typography } from '@/constants/theme';

export default function AuthLayoutWeb() {
  return (
    <View
      style={
        {
          flex: 1,
          backgroundColor: colors.background.secondary,
          minHeight: '100vh',
        } as any
      }
    >
      <View
        style={{
          paddingTop: spacing.xl,
          paddingHorizontal: spacing.lg,
          alignItems: 'center',
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
          }}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
              W
            </Text>
          </View>
          <Text
            style={{
              ...typography.lg,
              fontWeight: '700',
              color: colors.text.primary,
              letterSpacing: -0.3,
            }}
          >
            Wysta
          </Text>
        </View>
      </View>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          paddingVertical: spacing.lg,
        }}
      >
        <View
          style={
            {
              flex: 1,
              width: '100%',
              maxWidth: 480,
              backgroundColor: colors.background.primary,
              borderRadius: 16,
              boxShadow:
                '0 1px 3px rgba(0,0,0,0.05), 0 8px 24px rgba(124,58,237,0.06)',
            } as any
          }
        >
          <Slot />
        </View>
      </View>
    </View>
  );
}
