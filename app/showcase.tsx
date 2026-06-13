import { ScrollView, View, Text } from 'react-native';
import { useState } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Avatar } from '@/components/ui/Avatar';
import { Skeleton } from '@/components/ui/Skeleton';
import { fonts } from '@/lib/fonts';

export default function Showcase() {
  const [text, setText] = useState('');
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.h1} testID="showcase-title">Wysta UI</Text>

      <Text style={styles.h2}>Buttons</Text>
      <Button label="Primária" onPress={() => {}} kind="primary" testID="btn-primary" />
      <Button label="Secundária" onPress={() => {}} kind="secondary" />
      <Button label="Perigo" onPress={() => {}} kind="danger" />
      <Button label="Ghost" onPress={() => {}} kind="ghost" />
      <Button label="Pequena" onPress={() => {}} size="sm" />
      <Button label="A carregar" onPress={() => {}} loading />

      <Text style={styles.h2}>Input</Text>
      <Input label="Email" value={text} onChangeText={setText} placeholder="nome@exemplo.pt" />
      <Input label="Com erro" value="" onChangeText={() => {}} error="Campo obrigatório" />

      <Text style={styles.h2}>Cards</Text>
      <Card><Text style={styles.body}>Surface card</Text></Card>
      <Card tone="sunken"><Text style={styles.body}>Sunken card</Text></Card>

      <Text style={styles.h2}>Chips</Text>
      <View style={styles.row}>
        <Chip label="Contraceção" topic="contraception" />
        <Chip label="Ciclo" topic="cycle" />
        <Chip label="Saúde íntima" topic="intimate" />
        <Chip label="Gravidez" topic="pregnancy" />
        <Chip label="Geral" topic="general" />
        <Chip label="Selecionado" selected onPress={() => {}} />
        <Chip label="Neutro" onPress={() => {}} />
      </View>

      <Text style={styles.h2}>Avatars</Text>
      <View style={styles.row}>
        <Avatar initials="W" tone="ink" />
        <Avatar initials="RM" tone="lilac" />
        <Avatar initials="AI" tone="mint" />
      </View>

      <Text style={styles.h2}>Skeleton</Text>
      <Skeleton height={20} />
      <Skeleton width="60%" height={20} />
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, gap: theme.spacing.sm },
  h1: { fontFamily: fonts.displayExtraBold, fontSize: 30, color: theme.colors.ink },
  h2: {
    fontFamily: fonts.displayBold,
    fontSize: 18,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.md,
  },
  body: { fontSize: 16, fontWeight: '500', color: theme.colors.textPrimary },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
}));
