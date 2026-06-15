import { Pressable, Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

type TopicKey = 'contraception' | 'cycle' | 'intimate' | 'pregnancy' | 'general' | 'wellbeing';

type Props = {
  label: string;
  topic?: TopicKey;
  selected?: boolean;
  onPress?: () => void;
  testID?: string;
};

export function Chip({ label, topic, selected, onPress, testID }: Props) {
  styles.useVariants({
    mode: topic ? 'topic' : selected ? 'selected' : 'neutral',
    topic: topic ?? 'general',
  });

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.chip,
        pressed && onPress ? styles.pressed : null,
      ]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  chip: {
    borderRadius: theme.radius.pill,
    borderCurve: 'continuous',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    alignSelf: 'flex-start',
    variants: {
      mode: {
        neutral: { backgroundColor: theme.colors.surfaceSunken },
        selected: { backgroundColor: theme.colors.ink },
        topic: {},
      },
      topic: {
        contraception: {},
        cycle: {},
        intimate: {},
        pregnancy: {},
        general: {},
        wellbeing: {},
      },
    },
    compoundVariants: [
      { mode: 'topic', topic: 'contraception', styles: { backgroundColor: theme.topic.contraception.fill } },
      { mode: 'topic', topic: 'cycle', styles: { backgroundColor: theme.topic.cycle.fill } },
      { mode: 'topic', topic: 'intimate', styles: { backgroundColor: theme.topic.intimate.fill } },
      { mode: 'topic', topic: 'pregnancy', styles: { backgroundColor: theme.topic.pregnancy.fill } },
      { mode: 'topic', topic: 'general', styles: { backgroundColor: theme.topic.general.fill } },
      { mode: 'topic', topic: 'wellbeing', styles: { backgroundColor: theme.topic.wellbeing.fill } },
    ],
  },
  pressed: { opacity: 0.9 },
  label: {
    fontSize: 13,
    fontWeight: '500',
    variants: {
      mode: {
        neutral: { color: theme.colors.textPrimary },
        selected: { color: theme.colors.onInk },
        topic: {},
      },
      topic: {
        contraception: {},
        cycle: {},
        intimate: {},
        pregnancy: {},
        general: {},
        wellbeing: {},
      },
    },
    compoundVariants: [
      { mode: 'topic', topic: 'contraception', styles: { color: theme.topic.contraception.on } },
      { mode: 'topic', topic: 'cycle', styles: { color: theme.topic.cycle.on } },
      { mode: 'topic', topic: 'intimate', styles: { color: theme.topic.intimate.on } },
      { mode: 'topic', topic: 'pregnancy', styles: { color: theme.topic.pregnancy.on } },
      { mode: 'topic', topic: 'general', styles: { color: theme.topic.general.on } },
      { mode: 'topic', topic: 'wellbeing', styles: { color: theme.topic.wellbeing.on } },
    ],
  },
}));
