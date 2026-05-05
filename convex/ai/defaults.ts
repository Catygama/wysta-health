// Canonical default prompts and model recommendations per purpose. Tuned to
// be clinically conservative and to refuse hallucinating content not present
// in the conversation. Update via PR — these are the source of truth that
// the admin "Aplicar setup default" button writes into aiPrompts.

import type { AiPurpose, AiProvider } from './types';

export type PromptDefault = {
  systemPrompt: string;
  userTemplate: string;
  temperature: number;
  maxTokens: number;
};

export type ConfigDefault = {
  provider: AiProvider;
  modelId: string;
};

export const DEFAULT_PROMPTS: Partial<Record<AiPurpose, PromptDefault>> = {
  'chat-summary': {
    systemPrompt: [
      'És uma assistente clínica que sumariza conversas assíncronas entre',
      'utentes (pacientes) e profissionais de saúde da plataforma Wysta —',
      'saúde sexual e reprodutiva feminina, contexto português.',
      '',
      'Produz um sumário em português europeu, estruturado em 3 secções',
      'curtas (1-2 frases cada), nesta ordem exata:',
      '',
      '1. **Motivo**: o que a utente trouxe.',
      '2. **Resposta clínica**: o que o profissional respondeu, recomendou',
      '   ou prescreveu. Se o profissional ainda não respondeu, escreve',
      '   exatamente "Sem resposta do profissional ainda."',
      '3. **Próximos passos**: ações combinadas (consulta presencial,',
      '   exames, follow-up, contacto se piorar). Se não foram definidos,',
      '   escreve exatamente "Nenhum próximo passo definido."',
      '',
      'Regras estritas:',
      '- NÃO INVENTES informação. Só sumarizas o que está literalmente',
      '  na conversa. Se uma secção não tem material, usa a frase fixa',
      '  acima em vez de inferir.',
      '- Não incluas nome próprio da utente, morada concreta, profissão,',
      '  ou outros identificadores não-clínicos. Idade aproximada e',
      '  condições/medicações relevantes podem ficar.',
      '- Sê concisa e clínica. Evita jargão técnico desnecessário.',
      '- Português europeu — sem brasileirismos.',
      '- Não uses Markdown nas frases — só os títulos numerados acima',
      '  podem usar **negrito**.',
    ].join('\n'),
    userTemplate: [
      'Conversa entre utente e profissional (turnos por linha):',
      '',
      '{{conversationText}}',
      '',
      'Produz o sumário seguindo a estrutura definida.',
    ].join('\n'),
    temperature: 0.2,
    maxTokens: 350,
  },
};

export const DEFAULT_CONFIGS: Partial<Record<AiPurpose, ConfigDefault>> = {
  'chat-summary': {
    provider: 'openai',
    modelId: 'gpt-4o-mini',
  },
};
