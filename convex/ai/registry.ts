// Single source of truth for the AI subsystem's purposes and providers.
//
// Before this file the `aiPurpose` / `aiProvider` validators were hand-copied
// into seven places (schema, configs, prompts, invocations, setup, runAgent,
// types). Adding a purpose meant editing all seven and hoping they stayed in
// sync. Now everything imports from here: the validators, the TS unions, and
// the per-purpose metadata the admin UI renders.
//
// To add a new agent/purpose: add it to AI_PURPOSES, to aiPurposeValidator,
// and to AI_PURPOSE_META below. Then give it a default in defaults.ts. The
// admin control plane picks it up automatically — no UI changes needed.

import { v } from 'convex/values';

// --- Purposes -------------------------------------------------------------

export const AI_PURPOSES = [
  'chat-summary',
  'user-summary',
  'chat',
  'chat-validator-safety',
  'chat-validator-clinical',
  'chat-judge',
] as const;

export type AiPurpose = (typeof AI_PURPOSES)[number];

// Keep the literals here in lockstep with AI_PURPOSES above. We can't spread a
// mapped array into v.union without losing Convex's precise arg-type inference,
// so the union is written out explicitly — but it lives in exactly one file now.
export const aiPurposeValidator = v.union(
  v.literal('chat-summary'),
  v.literal('user-summary'),
  v.literal('chat'),
  v.literal('chat-validator-safety'),
  v.literal('chat-validator-clinical'),
  v.literal('chat-judge')
);

// --- Providers ------------------------------------------------------------

export const AI_PROVIDERS = [
  'openai',
  'anthropic',
  'mistral',
  'google',
  'azure-openai',
  'custom',
] as const;

export type AiProvider = (typeof AI_PROVIDERS)[number];

export const aiProviderValidator = v.union(
  v.literal('openai'),
  v.literal('anthropic'),
  v.literal('mistral'),
  v.literal('google'),
  v.literal('azure-openai'),
  v.literal('custom')
);

// Providers we've actually wired in llm.ts. The others are accepted by the
// schema (so a config can be drafted ahead of time) but will throw at call
// time until a case is added to buildModel().
export const WIRED_PROVIDERS: readonly AiProvider[] = ['openai', 'anthropic'];

// --- Per-purpose metadata (drives the admin UI) ---------------------------

export type PurposeMeta = {
  /** Human label shown in the admin control plane (PT-PT). */
  label: string;
  /** One-line description of what this agent does. */
  description: string;
  /** Logical group, used to section the admin screen. */
  group: 'resumos' | 'assistente';
  /** Template variables the userTemplate may reference ({{name}}). */
  variables: readonly string[];
  /** True when the agent is expected to emit structured JSON. */
  producesJson: boolean;
};

// --- Orchestration topology (drives the admin pipeline diagram) -----------
//
// Declarative description of how purposes wire together at runtime. This is the
// single source the admin "Como os agentes se ligam" diagram reads. Keep it in
// lockstep with the actual orchestration in assistant.ts (draft → safety +
// clinical validators in parallel → judge).

export type PipelineStep = {
  purpose: AiPurpose;
  /** Purposes whose output feeds this step. Empty = entry node. */
  dependsOn: readonly AiPurpose[];
};

export type Pipeline = {
  id: string;
  label: string;
  description: string;
  steps: readonly PipelineStep[];
};

export const AI_PIPELINES: readonly Pipeline[] = [
  {
    id: 'assistant',
    label: 'Assistente — resposta à utente',
    description:
      'O rascunho passa por dois validadores em paralelo; o juiz decide enviar ou bloquear.',
    steps: [
      { purpose: 'chat', dependsOn: [] },
      { purpose: 'chat-validator-safety', dependsOn: ['chat'] },
      { purpose: 'chat-validator-clinical', dependsOn: ['chat'] },
      {
        purpose: 'chat-judge',
        dependsOn: ['chat-validator-safety', 'chat-validator-clinical'],
      },
    ],
  },
  {
    id: 'summaries',
    label: 'Resumos — agentes independentes',
    description: 'Uso único, sem cadeia: corrido ao fechar conversa / ao construir perfil.',
    steps: [
      { purpose: 'chat-summary', dependsOn: [] },
      { purpose: 'user-summary', dependsOn: [] },
    ],
  },
];

export const AI_PURPOSE_META: Record<AiPurpose, PurposeMeta> = {
  'chat-summary': {
    label: 'Resumo de conversa',
    description:
      'Sumariza uma conversa fechada entre utente e enfermeiro (motivo, resposta, próximos passos).',
    group: 'resumos',
    variables: ['conversationText'],
    producesJson: false,
  },
  'user-summary': {
    label: 'Resumo de perfil',
    description:
      'Constrói um resumo de perfil da utente para o enfermeiro ver ao abrir a conversa.',
    group: 'resumos',
    variables: ['profileData', 'conversationSummaries'],
    producesJson: false,
  },
  chat: {
    label: 'Assistente — rascunho',
    description: 'Gera o rascunho da resposta à utente (passo 1 da cadeia).',
    group: 'assistente',
    variables: [
      'topicAndRisk',
      'patientProfile',
      'recentSummary',
      'conversationHistory',
      'query',
    ],
    producesJson: false,
  },
  'chat-validator-safety': {
    label: 'Validador — segurança',
    description: 'Aprova ou bloqueia o rascunho do ponto de vista de segurança (passo 2).',
    group: 'assistente',
    variables: ['patientProfile', 'recentSummary', 'conversationHistory', 'query', 'draft'],
    producesJson: true,
  },
  'chat-validator-clinical': {
    label: 'Validador — clínico',
    description: 'Aprova ou bloqueia o rascunho do ponto de vista clínico (passo 2).',
    group: 'assistente',
    variables: ['patientProfile', 'recentSummary', 'conversationHistory', 'query', 'draft'],
    producesJson: true,
  },
  'chat-judge': {
    label: 'Juiz',
    description: 'Decide enviar ou bloquear com base nos pareceres dos validadores (passo 3).',
    group: 'assistente',
    variables: ['draft', 'safety', 'clinical'],
    producesJson: true,
  },
};
