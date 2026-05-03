import type { IconName } from '@/components/ui/Icon';

export type TopicId =
  | 'contraception'
  | 'pregnancy'
  | 'sti'
  | 'menstrual-cycle'
  | 'general';

export type Topic = {
  id: TopicId;
  label: string;
  icon: IconName;
  description: string;
};

export const TOPICS: Topic[] = [
  {
    id: 'contraception',
    label: 'Contraceção',
    icon: { sf: 'pills.fill', ion: 'medical' },
    description: 'Métodos contracetivos, dúvidas e gestão',
  },
  {
    id: 'pregnancy',
    label: 'Gravidez',
    icon: { sf: 'figure.and.child.holdinghands', ion: 'body' },
    description: 'Acompanhamento, dúvidas e pós-parto',
  },
  {
    id: 'sti',
    label: 'IST',
    icon: { sf: 'cross.case.fill', ion: 'medkit' },
    description: 'Infeções sexualmente transmissíveis',
  },
  {
    id: 'menstrual-cycle',
    label: 'Ciclo Menstrual',
    icon: { sf: 'calendar', ion: 'calendar' },
    description: 'Irregularidades, dor e alterações',
  },
  {
    id: 'general',
    label: 'Saúde Geral',
    icon: { sf: 'heart.text.square.fill', ion: 'heart' },
    description: 'Outras questões de saúde',
  },
];

export const TOPIC_BY_ID: Record<TopicId, Topic> = TOPICS.reduce(
  (acc, t) => ({ ...acc, [t.id]: t }),
  {} as Record<TopicId, Topic>
);

export function topicLabel(id: string): string {
  return TOPIC_BY_ID[id as TopicId]?.label ?? id;
}
