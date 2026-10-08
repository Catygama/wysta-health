import { ScrollView, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '@/components/ui/Icon';
import { fonts } from '@/lib/fonts';
import { PRIVACY_POLICY, PRIVACY_POLICY_UPDATED } from '@/constants/privacyPolicy';

// Privacy policy, readable signed in or not (linked from sign-up and the
// "Entrar sem conta" consent).
export default function PrivacyPolicy() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useUnistyles();
  return (
    <ScrollView
      testID="privacy-policy"
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Voltar"
        hitSlop={8}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        style={styles.back}
      >
        <Icon name={{ sf: 'chevron.left', ion: 'chevron-back' }} size={22} color={theme.colors.inkText} />
        <Text style={styles.backText}>Voltar</Text>
      </Pressable>
      <Text accessibilityRole="header" style={styles.title}>
        Política de privacidade
      </Text>
      <Text style={styles.updated}>Atualizada a {PRIVACY_POLICY_UPDATED}</Text>
      {PRIVACY_POLICY.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            {section.title}
          </Text>
          {section.body.map((p) => (
            <Text key={p} style={styles.paragraph}>
              {p}
            </Text>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: theme.spacing.lg, gap: theme.spacing.md, maxWidth: 720, width: '100%', alignSelf: 'center' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, alignSelf: 'flex-start' },
  backText: { fontSize: 16, color: theme.colors.inkText },
  title: { fontFamily: fonts.displayBold, fontSize: 28, color: theme.colors.inkText },
  updated: { fontSize: 13, color: theme.colors.textSecondary },
  section: { gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  sectionTitle: { fontFamily: fonts.displayBold, fontSize: 19, color: theme.colors.inkText },
  paragraph: { fontSize: 16, lineHeight: 24, color: theme.colors.textPrimary },
}));
