// Shared seed payloads for triage questionnaires and educational articles.
// Used by convex/seed.ts (admin-gated public seeder) and convex/testing.ts
// (E2E unrestricted re-seed).

import type { TopicId as Topic } from './topics';

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
  {
    title: 'Desejo sexual: o que é normal',
    topic: 'sexual-wellbeing',
    summary: 'O desejo varia ao longo da vida — fatores que o influenciam e quando falar com alguém.',
    tags: ['desejo', 'libido', 'bem-estar'],
    readingTimeMinutes: 5,
    content: `O desejo sexual é diferente de pessoa para pessoa e muda ao longo da vida. Não existe um número "certo" de vezes nem um nível "normal".

Pontos-chave:
- O desejo é influenciado por sono, stress, hormonas, relação, medicação e fase da vida.
- Desejo espontâneo e desejo responsivo (que surge com o estímulo) são ambos normais.
- Variações temporárias são comuns; o que importa é se te causa mal-estar.

Se a falta de desejo te incomoda de forma persistente, vale a pena conversar — com o par e, se quiseres, com um profissional.`,
    whenToSeekHelp: `Considera falar com um profissional se:
- A ausência de desejo dura há meses e causa sofrimento.
- Surgiu de forma súbita após começar uma medicação.
- Vem acompanhada de dor, tristeza persistente ou problemas na relação.`,
  },
  {
    title: 'Prazer e orgasmo: anatomia e mitos',
    topic: 'sexual-wellbeing',
    summary: 'Como funciona o prazer feminino, o papel do clítoris e os mitos mais comuns.',
    tags: ['prazer', 'orgasmo', 'anatomia'],
    readingTimeMinutes: 6,
    content: `O prazer feminino é normal, saudável e merece espaço. A maioria das pessoas com vulva atinge o orgasmo sobretudo por estimulação do clítoris.

Pontos-chave:
- O clítoris é um órgão dedicado ao prazer, com muito mais estrutura do que a parte visível.
- Não há um único tipo de orgasmo "certo"; a variabilidade é a norma.
- Lubrificação e tempo de excitação variam — pressa é inimiga do prazer.
- A masturbação é uma forma segura de te conheceres e descobrires o que gostas.

Conhecer o teu corpo torna mais fácil comunicar o que te dá prazer.`,
    whenToSeekHelp: `Procura ajuda se:
- Sentes dor durante a estimulação ou as relações.
- Houve uma mudança marcada na capacidade de sentir prazer.
- A dificuldade em chegar ao orgasmo te causa sofrimento persistente.`,
  },
  {
    title: 'Dor nas relações: quando procurar ajuda',
    topic: 'sexual-wellbeing',
    summary: 'A dor sexual (dispareunia) é comum e tratável — não a normalizes em silêncio.',
    tags: ['dor', 'dispareunia', 'saúde'],
    readingTimeMinutes: 5,
    content: `Sentir dor nas relações (dispareunia) é frequente, mas NÃO é algo que tenhas de aceitar como normal. Tem causas tratáveis.

Pontos-chave:
- Causas comuns: falta de lubrificação, tensão muscular, infeções, alterações hormonais, endometriose.
- Lubrificante e mais tempo de excitação ajudam em muitos casos de desconforto ligeiro.
- Dor persistente, intensa ou com sangramento merece avaliação clínica.

Falar sobre isto não é exagero — é cuidar de ti.`,
    whenToSeekHelp: `Procura ajuda se:
- A dor é persistente, intensa ou impede as relações.
- Há sangramento associado às relações.
- Surge com febre, corrimento anormal ou outros sintomas.`,
  },
  {
    title: 'Comunicar desejos com o par',
    topic: 'sexual-wellbeing',
    summary: 'Falar sobre o que gostas (e o que não) aumenta a satisfação e a segurança.',
    tags: ['comunicação', 'relação', 'consentimento'],
    readingTimeMinutes: 4,
    content: `A comunicação é uma das maiores aliadas do prazer e da intimidade. Pedir o que gostas não é exigente — é cuidar da relação.

Pontos-chave:
- Escolhe um momento calmo, fora da cama, para conversas mais sensíveis.
- Fala na primeira pessoa ("eu gosto de...", "apetece-me...") em vez de críticas.
- O consentimento é contínuo e pode ser retirado a qualquer momento.
- Pequenos "sim" e "assim" durante o momento também são comunicação.

Uma relação onde podes dizer "não" é também onde o "sim" tem mais valor.`,
    whenToSeekHelp: `Considera apoio se:
- Sentes que não consegues dizer não ou que não és ouvida.
- Há pressão, medo ou coação — isso nunca é aceitável.
- A falta de comunicação está a causar sofrimento na relação.`,
  },
  {
    title: 'Autoconhecimento e exploração do corpo',
    topic: 'sexual-wellbeing',
    summary: 'Conhecer o teu corpo é a base de uma vida sexual saudável e satisfatória.',
    tags: ['autoconhecimento', 'masturbação', 'corpo'],
    readingTimeMinutes: 4,
    content: `Explorar o próprio corpo é saudável e ajuda-te a perceber o que te dá prazer, o que depois é mais fácil de comunicar.

Pontos-chave:
- A masturbação é segura e comum; não tem qualquer impacto negativo na saúde.
- Explora sem pressa e sem objetivo de "desempenho" — o foco é o que sentes.
- Lubrificante pode tornar a experiência mais confortável.
- Conhecer o teu corpo também te ajuda a notar alterações que mereçam atenção.

Não há forma "certa" — há a que te faz sentir bem.`,
    whenToSeekHelp: `Procura ajuda se:
- Notas alterações (caroços, feridas, dor) que te preocupam.
- Sentes culpa ou ansiedade persistentes ligadas à sexualidade.`,
  },
  {
    title: 'Sexualidade no pós-parto e na menopausa',
    topic: 'sexual-wellbeing',
    summary: 'Transições da vida mudam a sexualidade — o que esperar e como cuidar de ti.',
    tags: ['pós-parto', 'menopausa', 'hormonas'],
    readingTimeMinutes: 5,
    content: `A sexualidade muda em fases como o pós-parto e a menopausa. São mudanças normais e há formas de as gerir com conforto.

Pontos-chave:
- No pós-parto, o cansaço, as hormonas e a recuperação afetam o desejo — dá tempo ao teu corpo.
- Na menopausa, a secura vaginal é comum; lubrificantes e hidratantes vaginais ajudam.
- O desejo pode mudar de espontâneo para responsivo — normal, não um problema.
- Há opções clínicas (incluindo hormonais locais) que um profissional pode avaliar.

Estas fases não são o fim da tua vida sexual — são um novo capítulo.`,
    whenToSeekHelp: `Procura ajuda se:
- A secura ou a dor tornam as relações desconfortáveis apesar de lubrificante.
- O impacto no bem-estar ou na relação é significativo.
- Há sangramento após a menopausa — isto merece sempre avaliação.`,
  },
];
