import type { IconName } from '@/components/ui/Icon';

export type TopicId = 'contraception' | 'pregnancy' | 'sti' | 'menstrual-cycle';

export const TOPICS: Array<{
  id: TopicId;
  label: string;
  icon: IconName;
  description: string;
}> = [
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
];
