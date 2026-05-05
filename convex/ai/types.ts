// TS-side mirrors of schema validators. Keep in lockstep with convex/schema.ts.
export type AiPurpose =
  | 'chat-summary'
  | 'user-summary'
  | 'chat'
  | 'chat-validator-safety'
  | 'chat-validator-clinical'
  | 'chat-judge';

export type AiProvider =
  | 'openai'
  | 'anthropic'
  | 'mistral'
  | 'google'
  | 'azure-openai'
  | 'custom';

export type AiInvocationStatus = 'pending' | 'success' | 'error' | 'blocked';
