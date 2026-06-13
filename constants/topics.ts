import type { IconName } from '@/components/ui/Icon';

export type TopicId =
  | 'contraception'
  | 'pregnancy'
  | 'sti'
  | 'menstrual-cycle'
  | 'general';

// `color` maps a topic to a pastel key in the unistyles theme (theme.topic.*),
// used for icon chips and accents across the redesigned UI.
export type TopicColor =
  | 'contraception'
  | 'cycle'
  | 'intimate'
  | 'pregnancy'
  | 'general';

export type Topic = {
  id: TopicId;
  label: string;
  icon: IconName;
  description: string;
  color: TopicColor;
};

export const TOPICS: Topic[] = [
  {
    id: 'contraception',
    label: 'Contraceção',
    icon: { sf: 'pills.fill', ion: 'medical' },
    description: 'Métodos contracetivos, dúvidas e gestão',
    color: 'contraception',
  },
  {
    id: 'pregnancy',
    label: 'Gravidez',
    icon: { sf: 'figure.and.child.holdinghands', ion: 'body' },
    description: 'Acompanhamento, dúvidas e pós-parto',
    color: 'pregnancy',
  },
  {
    id: 'sti',
    label: 'IST',
    icon: { sf: 'cross.case.fill', ion: 'medkit' },
    description: 'Infeções sexualmente transmissíveis',
    color: 'intimate',
  },
  {
    id: 'menstrual-cycle',
    label: 'Ciclo Menstrual',
    icon: { sf: 'calendar', ion: 'calendar' },
    description: 'Irregularidades, dor e alterações',
    color: 'cycle',
  },
  {
    id: 'general',
    label: 'Saúde Geral',
    icon: { sf: 'heart.text.square.fill', ion: 'heart' },
    description: 'Outras questões de saúde',
    color: 'general',
  },
];

export const TOPIC_BY_ID: Record<TopicId, Topic> = TOPICS.reduce(
  (acc, t) => ({ ...acc, [t.id]: t }),
  {} as Record<TopicId, Topic>
);

export function topicLabel(id: string): string {
  return TOPIC_BY_ID[id as TopicId]?.label ?? id;
}
