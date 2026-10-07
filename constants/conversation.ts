export const STATUS_LABELS: Record<string, string> = {
  waiting: 'A aguardar',
  active: 'Em curso',
  escalated: 'Escalada',
  closed: 'Encerrada',
};

export const STATUS_COLORS: Record<string, string> = {
  waiting: '#D97706',
  active: '#059669',
  escalated: '#DC2626',
  closed: '#6B7280',
};

export const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'Urgente',
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};

export const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#981F32',
  high: '#7F351A',
  medium: '#9C830B',
  low: '#829461',
};

// Same hues, lightened so they stay readable on the dark theme's plum page.
export const PRIORITY_COLORS_DARK: Record<string, string> = {
  urgent: '#FF8A9A',
  high: '#E8966E',
  medium: '#E2C45A',
  low: '#B5C99A',
};

export function priorityColors(themeName: string): Record<string, string> {
  return themeName === 'dark' ? PRIORITY_COLORS_DARK : PRIORITY_COLORS;
}

export const RISK_LABELS: Record<string, string> = {
  high: 'Alto',
  medium: 'Médio',
  low: 'Baixo',
};

export const ESCALATION_LEVEL_LABELS: Record<string, string> = {
  routine: 'Consulta de rotina',
  urgent: 'Consulta urgente (48h)',
  'same-day': 'Urgência no próprio dia',
  emergency: 'Emergência imediata',
};

// Path chosen on the patient Home ("Profissional de saúde" / "Assistente IA"),
// carried as the `mode` route param through topic picker → triage.
export type ConversationMode = 'professional' | 'ai';

export function kindForMode(mode: string | undefined): 'human-async' | 'ai-only' {
  return mode === 'ai' ? 'ai-only' : 'human-async';
}

// Risk colors come from the theme so they stay legible in dark mode.
export function riskColor(
  theme: { colors: { danger: string; warning: string; success: string } },
  level: string,
): string | undefined {
  const map: Record<string, string> = {
    high: theme.colors.danger,
    medium: theme.colors.warning,
    low: theme.colors.success,
  };
  return map[level];
}
