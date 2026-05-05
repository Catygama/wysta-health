import { Slot } from 'expo-router';
import { View, Text, useWindowDimensions } from 'react-native';
import { spacing, typography } from '@/constants/theme';
import { useTheme } from '@/lib/theme';

const MOBILE_BREAKPOINT = 640;

export default function AuthLayoutWeb() {
  const { width } = useWindowDimensions();
  const isMobile = width < MOBILE_BREAKPOINT;
  const { colors } = useTheme();

  return (
    <View
      style={
        {
          flex: 1,
          backgroundColor: isMobile
            ? colors.background.primary
            : colors.background.secondary,
          minHeight: '100vh',
        } as any
      }
    >
      <View
        style={{
          paddingTop: isMobile ? spacing.lg : spacing.xl,
          paddingHorizontal: spacing.lg,
          alignItems: isMobile ? 'flex-start' : 'center',
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
          paddingVertical: isMobile ? 0 : spacing.lg,
        }}
      >
        <View
          style={
            {
              flex: 1,
              width: '100%',
              maxWidth: isMobile ? undefined : 480,
              backgroundColor: colors.background.primary,
              borderRadius: isMobile ? 0 : 16,
              boxShadow: isMobile
                ? undefined
                : '0 1px 3px rgba(0,0,0,0.05), 0 8px 24px rgba(124,58,237,0.06)',
            } as any
          }
        >
          <Slot />
        </View>
      </View>
    </View>
  );
}
