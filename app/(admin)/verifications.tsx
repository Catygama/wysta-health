import { ScrollView, Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { VerificationRequests } from '@/components/admin/VerificationRequests';
import { fonts } from '@/lib/fonts';

// "Verificações": professional sign-ups waiting for an admin to approve or
// reject them.
export default function AdminVerifications() {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Text style={styles.title} accessibilityRole="header">
        Verificações
      </Text>
      <VerificationRequests />
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md, gap: theme.spacing.md },
  title: { fontFamily: fonts.displayExtraBold, fontSize: 26, color: theme.colors.inkText },
}));
