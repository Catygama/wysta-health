import type { AlertLevel, Priority } from '@/convex/lib/alerts';
import type { TopicId } from '@/convex/lib/topics';

export type Call = '112' | 'SNS 24' | 'SNS Grávida' | null;

export type TriageCase = {
  id: string;
  topic: TopicId;
  description: string;
  responses: Record<string, string | number>;
  expected: { level: AlertLevel | null; priority: Priority; call: Call };
};

const calm: Partial<Record<TopicId, Record<string, string | number>>> = {
  'menstrual-cycle': {
    'pain-intensity': 3,
    'heavy-bleeding': 'no',
    'ectopic-signs': 'no',
    duration: '1-3 dias',
    'fever-pain': 'no',
  },
  contraception: {
    'current-method': 'Pílula',
    'main-concern': 'Eficácia do método',
    unprotected: 'no',
  },
  sti: { discharge: 'no', lesions: 'no', 'urination-pain': 'no', 'fever-pain': 'no' },
  pregnancy: {
    weeks: 'Menos de 12 semanas',
    bleeding: 'no',
    'abdominal-pain': 'no',
    'preeclampsia-signs': 'no',
    'fluid-loss': 'no',
  },
  general: { reason: 'Dúvidas de saúde', 'alarm-signs': 'no', duration: '1-3 dias' },
};

function c(
  id: string,
  topic: TopicId,
  description: string,
  changes: Record<string, string | number>,
  expected: TriageCase['expected'],
): TriageCase {
  return { id, topic, description, responses: { ...calm[topic], ...changes }, expected };
}

const none = (priority: Priority): TriageCase['expected'] => ({ level: null, priority, call: null });

export const TRIAGE_CASES: TriageCase[] = [
  // Ciclo menstrual
  c('MC-01', 'menstrual-cycle', 'Sem sinais de alarme, dor 3', {}, none('low')),
  c('MC-02', 'menstrual-cycle', 'Dor 8 (abaixo do limiar)', { 'pain-intensity': 8 }, none('medium')),
  c('MC-03', 'menstrual-cycle', 'Dor 9 (limiar)', { 'pain-intensity': 9 }, { level: 'urgent', priority: 'urgent', call: 'SNS 24' }),
  c('MC-04', 'menstrual-cycle', 'Dor 10', { 'pain-intensity': 10 }, { level: 'urgent', priority: 'urgent', call: 'SNS 24' }),
  c('MC-05', 'menstrual-cycle', 'Sangramento muito intenso ou tonturas', { 'heavy-bleeding': 'yes' }, { level: 'urgent', priority: 'urgent', call: 'SNS 24' }),
  c('MC-06', 'menstrual-cycle', 'Atraso + dor forte de um lado (gravidez ectópica)', { 'ectopic-signs': 'yes' }, { level: 'emergency', priority: 'urgent', call: '112' }),
  c('MC-07', 'menstrual-cycle', 'Febre com dor pélvica', { 'fever-pain': 'yes' }, { level: 'urgent', priority: 'urgent', call: 'SNS 24' }),
  c('MC-08', 'menstrual-cycle', 'Sintomas há 4-7 dias', { duration: '4-7 dias' }, none('medium')),
  c('MC-09', 'menstrual-cycle', 'Sintomas há mais de 1 semana', { duration: 'Mais de 1 semana' }, none('medium')),
  c('MC-10', 'menstrual-cycle', 'Dor 9 + sinais de ectópica (prevalece o mais grave)', { 'pain-intensity': 9, 'ectopic-signs': 'yes' }, { level: 'emergency', priority: 'urgent', call: '112' }),

  // Contraceção
  c('CT-01', 'contraception', 'Dúvida sobre eficácia, sem relações desprotegidas', {}, none('low')),
  c('CT-02', 'contraception', 'Efeitos secundários', { 'main-concern': 'Efeitos secundários' }, none('medium')),
  c('CT-03', 'contraception', 'Pede contraceção de emergência', { 'main-concern': 'Contraceção de emergência' }, { level: 'time-sensitive', priority: 'high', call: null }),
  c('CT-04', 'contraception', 'Relações desprotegidas nos últimos 5 dias', { unprotected: 'yes' }, { level: 'time-sensitive', priority: 'high', call: null }),
  c('CT-05', 'contraception', 'Sem método + relações desprotegidas', { 'current-method': 'Nenhum', unprotected: 'yes' }, { level: 'time-sensitive', priority: 'high', call: null }),

  // IST
  c('ST-01', 'sti', 'Sem sintomas', {}, none('low')),
  c('ST-02', 'sti', 'Corrimento diferente', { discharge: 'yes' }, none('medium')),
  c('ST-03', 'sti', 'Ardor ao urinar', { 'urination-pain': 'yes' }, none('medium')),
  c('ST-04', 'sti', 'Lesões visíveis (sobe na fila, sem aviso)', { lesions: 'yes' }, { level: 'priority', priority: 'high', call: null }),
  c('ST-05', 'sti', 'Febre com dor abdominal baixa', { 'fever-pain': 'yes' }, { level: 'urgent', priority: 'urgent', call: 'SNS 24' }),
  c('ST-06', 'sti', 'Lesões + febre (prevalece o mais grave)', { lesions: 'yes', 'fever-pain': 'yes' }, { level: 'urgent', priority: 'urgent', call: 'SNS 24' }),

  // Gravidez
  c('PG-01', 'pregnancy', 'Gravidez inicial sem sintomas', {}, none('low')),
  c('PG-02', 'pregnancy', 'Sangramento abundante', { bleeding: 'yes' }, { level: 'emergency', priority: 'urgent', call: '112' }),
  c('PG-03', 'pregnancy', 'Dor abdominal intensa', { 'abdominal-pain': 'yes' }, { level: 'emergency', priority: 'urgent', call: '112' }),
  c('PG-04', 'pregnancy', 'Sinais de pré-eclâmpsia', { 'preeclampsia-signs': 'yes' }, { level: 'urgent', priority: 'urgent', call: 'SNS Grávida' }),
  c('PG-05', 'pregnancy', 'Perda de líquido', { 'fluid-loss': 'yes' }, { level: 'urgent', priority: 'urgent', call: 'SNS Grávida' }),
  c('PG-06', 'pregnancy', '≥ 24 semanas, menos movimentos do bebé', { weeks: '24 semanas ou mais', 'reduced-movement': 'yes' }, { level: 'urgent', priority: 'urgent', call: 'SNS 24' }),
  c('PG-07', 'pregnancy', '≥ 24 semanas, movimentos normais', { weeks: '24 semanas ou mais', 'reduced-movement': 'no' }, none('low')),
  c('PG-08', 'pregnancy', 'Menos movimentos + sangramento (prevalece o mais grave)', { weeks: '24 semanas ou mais', 'reduced-movement': 'yes', bleeding: 'yes' }, { level: 'emergency', priority: 'urgent', call: '112' }),

  // Outros assuntos
  c('GN-01', 'general', 'Dúvida de saúde sem sinais de alarme', {}, none('low')),
  c('GN-02', 'general', 'Sintomas há mais de 1 semana', { duration: 'Mais de 1 semana' }, none('medium')),
  c('GN-03', 'general', 'Dificuldade em respirar, dor no peito, desmaio ou sangramento', { 'alarm-signs': 'yes' }, { level: 'emergency', priority: 'urgent', call: '112' }),
];
