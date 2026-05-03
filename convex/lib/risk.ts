type RiskBucket = { criteria: string[]; guidance: string };

export type RiskAssessment = {
  lowRisk: RiskBucket;
  mediumRisk: RiskBucket;
  highRisk: RiskBucket;
};

export type RiskLevel = 'low' | 'medium' | 'high';

const COMPARATORS = ['>=', '<=', '==', '!=', '>', '<'] as const;

function unquote(value: string) {
  return value.trim().replace(/^['"]|['"]$/g, '');
}

function evaluateCriterion(
  criterion: string,
  responses: Record<string, unknown>
): boolean {
  const trimmed = criterion.trim();
  for (const op of COMPARATORS) {
    const idx = trimmed.indexOf(` ${op} `);
    if (idx === -1) continue;
    const field = trimmed.slice(0, idx).trim();
    const raw = trimmed.slice(idx + op.length + 2).trim();
    const value = responses[field];
    if (op === '>=' || op === '<=' || op === '>' || op === '<') {
      const a = Number(value);
      const b = Number(raw);
      if (Number.isNaN(a) || Number.isNaN(b)) return false;
      if (op === '>=') return a >= b;
      if (op === '<=') return a <= b;
      if (op === '>') return a > b;
      return a < b;
    }
    const expected = unquote(raw);
    if (op === '==') return String(value) === expected;
    return String(value) !== expected;
  }
  if (trimmed.startsWith('!')) {
    const field = trimmed.slice(1).trim();
    const value = responses[field];
    return value === undefined || value === false || value === 'no' || value === '';
  }
  // Bare field name: truthy / "yes"
  const value = responses[trimmed];
  return value === true || value === 'yes';
}

export function calculateRiskLevel(
  responses: Record<string, unknown>,
  assessment: RiskAssessment | undefined
): RiskLevel {
  if (!assessment) return 'low';
  for (const c of assessment.highRisk.criteria) {
    if (evaluateCriterion(c, responses)) return 'high';
  }
  for (const c of assessment.mediumRisk.criteria) {
    if (evaluateCriterion(c, responses)) return 'medium';
  }
  return 'low';
}

export function priorityFromRisk(
  risk: RiskLevel
): 'low' | 'medium' | 'high' | 'urgent' {
  if (risk === 'high') return 'urgent';
  if (risk === 'medium') return 'medium';
  return 'low';
}
