export type TopicId = 'contraception' | 'pregnancy' | 'sti' | 'menstrual-cycle';

export const TOPICS: Array<{
  id: TopicId;
  label: string;
  emoji: string;
  description: string;
}> = [
  {
    id: 'contraception',
    label: 'Contraceção',
    emoji: '💊',
    description: 'Métodos contracetivos, dúvidas e gestão',
  },
  {
    id: 'pregnancy',
    label: 'Gravidez',
    emoji: '🤰',
    description: 'Acompanhamento, dúvidas e pós-parto',
  },
  {
    id: 'sti',
    label: 'IST',
    emoji: '🔬',
    description: 'Infeções sexualmente transmissíveis',
  },
  {
    id: 'menstrual-cycle',
    label: 'Ciclo Menstrual',
    emoji: '📅',
    description: 'Irregularidades, dor e alterações',
  },
];
