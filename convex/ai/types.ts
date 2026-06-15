// TS-side types for the AI subsystem. The purpose/provider unions are derived
// from the single registry in ./registry — re-exported here so existing
// imports (`./types`) keep working.
export type { AiPurpose, AiProvider } from './registry';

export type AiInvocationStatus = 'pending' | 'success' | 'error' | 'blocked';
