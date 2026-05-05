// Shared seed payloads for triage questionnaires and educational articles.
// Used by convex/seed.ts (admin-gated public seeder) and convex/testing.ts
// (E2E unrestricted re-seed).

type Topic =
  | 'contraception'
  | 'pregnancy'
  | 'sti'
  | 'menstrual-cycle'
  | 'general';

type RiskBucket = { criteria: string[]; guidance: string };

export type TriageSeed = {
  topic: Topic;
  questions: Array<{
    id: string;
    question: string;
    type: 'multiple-choice' | 'yes-no' | 'scale' | 'text';
    options?: string[];
    isRedFlag?: boolean;
    required: boolean;
  }>;
  riskAssessment: {
    lowRisk: RiskBucket;
    mediumRisk: RiskBucket;
    highRisk: RiskBucket;
  };
};

export type ArticleSeed = {
  title: string;
  topic: Topic;
  summary: string;
  content: string;
  whenToSeekHelp: string;
  tags: string[];
  readingTimeMinutes: number;
};

export const TRIAGE_SEEDS: TriageSeed[] = [
  {
    topic: 'menstrual-cycle',
    questions: [
      {
        id: 'pain-intensity',
        question: 'Qual a intensidade da dor (1 a 10)?',
        type: 'scale',
        options: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
        required: true,
      },
      {
        id: 'heavy-bleeding',
        question: 'Tem sangramento muito intenso (troca de penso a cada hora)?',
        type: 'yes-no',
        isRedFlag: true,
        required: true,
      },
      {
        id: 'duration',
        question: 'Há quantos dias sente estes sintomas?',
        type: 'multiple-choice',
        options: ['Menos de 24h', '1-3 dias', '4-7 dias', 'Mais de 1 semana'],
        required: true,
      },
      {
        id: 'fever',
        question: 'Tem febre (≥ 38°C)?',
        type: 'yes-no',
        isRedFlag: true,
        required: true,
      },
    ],
    riskAssessment: {
      lowRisk: {
        criteria: ['!heavy-bleeding', '!fever'],
        guidance: 'Sintomas ligeiros podem ser acompanhados com medidas de conforto.',
      },
      mediumRisk: {
        criteria: ['pain-intensity >= 6', "duration == '4-7 dias'"],
        guidance: 'Se a dor persistir, considere avaliação clínica.',
      },
      highRisk: {
        criteria: ['heavy-bleeding', 'fever', 'pain-intensity >= 9'],
        guidance: 'Sintomas graves exigem atenção imediata. Contacte 112 ou SNS 24.',
      },
    },
  },
  {
    topic: 'contraception',
    questions: [
      {
        id: 'current-method',
        question: 'Está a utilizar algum método contracetivo?',
        type: 'multiple-choice',
        options: ['Nenhum', 'Pílula', 'DIU', 'Implante', 'Preservativo', 'Outro'],
        required: true,
      },
      {
        id: 'main-concern',
        question: 'Qual a sua principal dúvida?',
        type: 'multiple-choice',
        options: [
          'Efeitos secundários',
          'Eficácia do método',
          'Iniciar novo método',
          'Parar método atual',
          'Contraceção de emergência',
        ],
        required: true,
      },
      {
        id: 'unprotected',
        question: 'Teve relações sem proteção nos últimos dias?',
        type: 'yes-no',
        isRedFlag: true,
        required: true,
      },
    ],
    riskAssessment: {
      lowRisk: {
        criteria: ["main-concern != 'Contraceção de emergência'", '!unprotected'],
        guidance: 'Informação geral sobre métodos contracetivos.',
      },
      mediumRisk: {
        criteria: ["main-concern == 'Efeitos secundários'"],
        guidance: 'Pode ser necessário ajustar o método em conjunto com profissional.',
      },
      highRisk: {
        criteria: ["main-concern == 'Contraceção de emergência'", 'unprotected'],
        guidance: 'Situação que pode requerer contraceção de emergência.',
      },
    },
  },
  {
    topic: 'sti',
    questions: [
      {
        id: 'discharge',
        question: 'Tem corrimento diferente do habitual?',
        type: 'yes-no',
        required: true,
      },
      {
        id: 'lesions',
        question: 'Tem feridas, verrugas ou lesões visíveis?',
        type: 'yes-no',
        isRedFlag: true,
        required: true,
      },
      {
        id: 'urination-pain',
        question: 'Sente dor ou ardor ao urinar?',
        type: 'yes-no',
        required: true,
      },
      {
        id: 'fever',
        question: 'Tem febre (≥ 38°C)?',
        type: 'yes-no',
        isRedFlag: true,
        required: true,
      },
    ],
    riskAssessment: {
      lowRisk: {
        criteria: ['!lesions', '!fever'],
        guidance: 'Sintomas ligeiros podem ser acompanhados; recomenda-se rastreio.',
      },
      mediumRisk: {
        criteria: ['discharge', 'urination-pain'],
        guidance: 'Pode ser necessário avaliação clínica e testes.',
      },
      highRisk: {
        criteria: ['lesions', 'fever'],
        guidance: 'Sintomas relevantes. Procure avaliação médica.',
      },
    },
  },
  {
    topic: 'pregnancy',
    questions: [
      {
        id: 'weeks',
        question: 'Quantas semanas de gravidez?',
        type: 'multiple-choice',
        options: [
          'Não tenho a certeza',
          'Menos de 12 semanas',
          '12-28 semanas',
          'Mais de 28 semanas',
        ],
        required: true,
      },
      {
        id: 'bleeding',
        question: 'Tem sangramento vaginal?',
        type: 'yes-no',
        isRedFlag: true,
        required: true,
      },
      {
        id: 'abdominal-pain',
        question: 'Sente dor abdominal intensa?',
        type: 'yes-no',
        isRedFlag: true,
        required: true,
      },
      {
        id: 'reduced-movement',
        question: 'Notou redução dos movimentos do bebé?',
        type: 'yes-no',
        isRedFlag: true,
        required: false,
      },
    ],
    riskAssessment: {
      lowRisk: {
        criteria: ['!bleeding', '!abdominal-pain', '!reduced-movement'],
        guidance: 'Sem sinais de urgência. Continue o acompanhamento.',
      },
      mediumRisk: {
        criteria: ["weeks == 'Menos de 12 semanas'"],
        guidance: 'Monitorize sintomas e acompanhe com o profissional.',
      },
      highRisk: {
        criteria: ['bleeding', 'abdominal-pain', 'reduced-movement'],
        guidance: 'Sintomas graves. Contacte 112 ou SNS 24.',
      },
    },
  },
  {
    topic: 'general',
    questions: [
      {
        id: 'reason',
        question: 'Qual o motivo principal do contacto?',
        type: 'multiple-choice',
        options: ['Sintomas gerais', 'Dúvidas de saúde', 'Seguimento', 'Outro'],
        required: true,
      },
      {
        id: 'severe-symptoms',
        question: 'Tem sintomas graves ou de início súbito?',
        type: 'yes-no',
        isRedFlag: true,
        required: true,
      },
      {
        id: 'duration',
        question: 'Há quanto tempo sente estes sintomas?',
        type: 'multiple-choice',
        options: ['Menos de 24h', '1-3 dias', '4-7 dias', 'Mais de 1 semana'],
        required: true,
      },
    ],
    riskAssessment: {
      lowRisk: {
        criteria: ['!severe-symptoms'],
        guidance: 'Sintomas ligeiros podem ser acompanhados com orientação.',
      },
      mediumRisk: {
        criteria: ["duration == 'Mais de 1 semana'"],
        guidance: 'Pode ser necessária avaliação adicional.',
      },
      highRisk: {
        criteria: ['severe-symptoms'],
        guidance: 'Sintomas graves exigem atenção imediata. Contacte 112 ou SNS 24.',
      },
    },
  },
];

export const ARTICLE_SEEDS: ArticleSeed[] = [
  {
    title: 'Entender o ciclo menstrual',
    topic: 'menstrual-cycle',
    summary:
      'O que é normal, o que monitorizar e quando uma alteração merece avaliação.',
    tags: ['ciclo', 'menstruação', 'dor'],
    readingTimeMinutes: 6,
    content: `O ciclo menstrual varia de pessoa para pessoa. É comum sentir algum desconforto, mas dores muito intensas ou sangramento excessivo merecem avaliação clínica.

Pontos-chave:
- Registar o ciclo ajuda a detetar padrões e alterações ao longo do tempo.
- Dor leve a moderada pode ser controlada com calor local e analgésicos comuns.
- Alterações súbitas (atraso significativo, sangramento entre ciclos, dor incapacitante) podem justificar avaliação.

Se houver impacto significativo no dia-a-dia, fala com um profissional de saúde.`,
    whenToSeekHelp: `Procure ajuda se:
- A dor for intensa, persistente ou impedir as suas atividades.
- Existir sangramento muito abundante (troca de penso a cada hora).
- Surgirem sintomas como febre, tonturas ou desmaio.`,
  },
  {
    title: 'Métodos contracetivos: guia completo',
    topic: 'contraception',
    summary:
      'Visão geral dos métodos disponíveis, o que considerar e como decidir com apoio profissional.',
    tags: ['contraceção', 'planeamento', 'saúde sexual'],
    readingTimeMinutes: 5,
    content: `Existem vários métodos contracetivos. A escolha depende do estado de saúde, estilo de vida e preferências pessoais.

Pontos-chave:
- Alguns métodos também protegem contra IST (ex.: preservativo).
- A contraceção de emergência é eficaz em janelas curtas e tem indicações específicas.
- O aconselhamento profissional ajuda a escolher o método mais adequado.

Cada método tem benefícios e limitações; o que funciona para alguém pode não ser ideal para outra pessoa.`,
    whenToSeekHelp: `Procure ajuda se:
- Teve relação sem proteção e está dentro da janela de contraceção de emergência.
- Teve falha no método contracetivo (rutura de preservativo, esquecimento prolongado da pílula).
- Tem efeitos secundários preocupantes que afetam o seu bem-estar.`,
  },
  {
    title: 'IST: prevenção e rastreio',
    topic: 'sti',
    summary: 'Como prevenir, sinais de alerta e a importância do rastreio regular.',
    tags: ['ist', 'prevenção', 'rastreio'],
    readingTimeMinutes: 4,
    content: `As infeções sexualmente transmissíveis (IST) podem ser prevenidas e a maioria é tratável quando diagnosticada cedo.

Pontos-chave:
- O preservativo é a principal forma de prevenção em relações sexuais.
- O rastreio regular é importante, sobretudo em novas relações ou após relações de risco.
- Algumas IST são assintomáticas — a ausência de sintomas não exclui infeção.`,
    whenToSeekHelp: `Procure ajuda se:
- Tiver corrimento diferente do habitual ou dor ao urinar.
- Surgirem feridas, verrugas ou lesões na zona genital.
- Aparecer febre, dor pélvica intensa ou mal-estar associado.`,
  },
  {
    title: 'Sinais de alerta na gravidez',
    topic: 'pregnancy',
    summary: 'Sintomas que requerem atenção imediata durante a gravidez.',
    tags: ['gravidez', 'sintomas', 'alerta'],
    readingTimeMinutes: 3,
    content: `Durante a gravidez existem sinais que requerem atenção imediata. Saber identificá-los ajuda a proteger a mãe e o bebé.

Pontos-chave:
- Sangramento vaginal e dor abdominal intensa não são considerados normais.
- A redução dos movimentos do bebé deve ser sempre avaliada após o segundo trimestre.
- Mantenha o acompanhamento pré-natal regular conforme orientação clínica.`,
    whenToSeekHelp: `Procure ajuda se:
- Tiver sangramento vaginal, com ou sem dor.
- Sentir dor abdominal intensa ou contínua.
- Notar redução dos movimentos do bebé.
- Tiver dores de cabeça intensas, perturbações da visão ou inchaço súbito.`,
  },
  {
    title: 'Bem-estar e saúde geral',
    topic: 'general',
    summary: 'Hábitos que apoiam a saúde física e emocional no dia-a-dia.',
    tags: ['bem-estar', 'saúde', 'prevenção'],
    readingTimeMinutes: 3,
    content: `Manter hábitos saudáveis melhora o bem-estar físico e emocional.

Pontos-chave:
- Alimentação equilibrada, sono regular e hidratação.
- Atividade física moderada e adaptada à fase de vida.
- Gestão do stress e atenção à saúde mental.`,
    whenToSeekHelp: `Procure ajuda se:
- Tiver sintomas persistentes que afetam o dia-a-dia.
- Se sentir ansiosa ou em baixo por longos períodos.
- Tiver dúvidas que não consegue esclarecer com informação geral.`,
  },
];
