import type { IconName } from '@/components/ui/Icon';
import type { TopicId } from '@/convex/lib/topics';
export type { TopicId };

// `color` maps a topic to a pastel key in the unistyles theme (theme.topic.*),
// used for icon chips and accents across the redesigned UI.
export type TopicColor =
  | 'contraception'
  | 'cycle'
  | 'intimate'
  | 'pregnancy'
  | 'general'
  | 'wellbeing';

export type Topic = {
  id: TopicId;
  label: string;
  icon: IconName;
  description: string;
  color: TopicColor;
  /**
   * Catch-all for questions that fit no specific topic. Not offered as a
   * topic choice; the UI shows a separate "ask anyway" entry point instead.
   */
  isCatchAll?: boolean;
};

export const TOPICS: Topic[] = [
  {
    id: 'contraception',
    label: 'Contraceção',
    icon: { sf: 'pills.fill', ion: 'medical', glyph: 'pill' },
    description: 'Métodos contracetivos, dúvidas e gestão',
    color: 'contraception',
  },
  {
    id: 'pregnancy',
    label: 'Gravidez',
    icon: { sf: 'figure.and.child.holdinghands', ion: 'body', glyph: 'baby' },
    description: 'Acompanhamento, dúvidas e pós-parto',
    color: 'pregnancy',
  },
  {
    id: 'sti',
    label: 'IST',
    icon: { sf: 'cross.case.fill', ion: 'medkit', glyph: 'virus' },
    description: 'Infeções sexualmente transmissíveis',
    color: 'intimate',
  },
  {
    id: 'menstrual-cycle',
    label: 'Ciclo menstrual',
    icon: { sf: 'calendar', ion: 'calendar', glyph: 'droplet-filled' },
    description: 'Irregularidades, dor e alterações',
    color: 'cycle',
  },
  {
    id: 'sexual-wellbeing',
    label: 'Bem-estar sexual',
    icon: { sf: 'camera.macro', ion: 'flower', glyph: 'flower-lotus' },
    description: 'Desejo, prazer, intimidade e autoconhecimento',
    color: 'wellbeing',
  },
  {
    id: 'general',
    label: 'Outros assuntos',
    icon: { sf: 'questionmark.bubble.fill', ion: 'help-circle', glyph: 'message-circle-question' },
    description: 'Não encaixa em nenhum dos temas',
    color: 'general',
    isCatchAll: true,
  },
];

/** Topics offered as choices when starting a conversation. */
export const TOPIC_CHOICES: Topic[] = TOPICS.filter((t) => !t.isCatchAll);

export const TOPIC_BY_ID: Record<TopicId, Topic> = TOPICS.reduce(
  (acc, t) => ({ ...acc, [t.id]: t }),
  {} as Record<TopicId, Topic>
);

/** Where questions that fit no topic go (the 'general' id, kept for existing data). */
export const OTHER_TOPIC: Topic = TOPIC_BY_ID.general;

export function topicLabel(id: string): string {
  return TOPIC_BY_ID[id as TopicId]?.label ?? id;
}
