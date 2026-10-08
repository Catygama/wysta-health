// Writes docs/testing/triagem-casos.md: one row per triage case with the
// expected and obtained level, priority and number to call.
// Run: bun scripts/triage-report.ts
import { writeFileSync, mkdirSync } from 'node:fs';
import { ALERT_LABELS } from '@/constants/triageAlerts';
import { TRIAGE_CASES } from '@/tests/triage/cases';
import { evaluateCase } from '@/tests/triage/evaluate';
import type { AlertLevel } from '@/convex/lib/alerts';

const PRIORITY: Record<string, string> = { urgent: 'Urgente', high: 'Alta', medium: 'Média', low: 'Baixa' };
const level = (l: AlertLevel | null) => (l ? ALERT_LABELS[l] : '—');
const answers = (r: Record<string, string | number>) =>
  Object.entries(r)
    .filter(([, v]) => v !== 'no')
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ');

let passed = 0;
const rows = TRIAGE_CASES.map((tc) => {
  const got = evaluateCase(tc);
  const ok =
    got.level === tc.expected.level && got.priority === tc.expected.priority && got.call === tc.expected.call;
  if (ok) passed++;
  return `| ${tc.id} | ${tc.description} | ${answers(tc.responses)} | ${level(tc.expected.level)} / ${PRIORITY[tc.expected.priority]} / ${tc.expected.call ?? '—'} | ${level(got.level)} / ${PRIORITY[got.priority]} / ${got.call ?? '—'} | ${ok ? '✅' : '❌'} |`;
});

const md = `# Casos de teste da triagem

Gerado por \`bun scripts/triage-report.ts\` em ${new Date().toISOString().slice(0, 10)}. Os mesmos casos correm em \`tests/triage/triage.cases.test.ts\` (\`bun run test\`).

Cada caso parte de respostas sem sinais de alarme e muda só o indicado. "Respostas" omite as respostas "no". Coluna = nível do aviso / prioridade na fila / número sugerido.

**Resultado: ${passed}/${TRIAGE_CASES.length} casos corretos.**

| ID | Caso | Respostas | Esperado | Obtido | |
|---|---|---|---|---|---|
${rows.join('\n')}
`;

mkdirSync('docs/testing', { recursive: true });
writeFileSync('docs/testing/triagem-casos.md', md);
console.log(`${passed}/${TRIAGE_CASES.length} cases passed → docs/testing/triagem-casos.md`);
if (passed !== TRIAGE_CASES.length) process.exit(1);
