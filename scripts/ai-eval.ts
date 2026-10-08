// Runs every question in tests/ai/cases.ts through the real assistant chain
// (ai/evaluation:runCase) and writes docs/testing/ia-avaliacao.md.
// Each question costs four LLM calls on the target deployment.
// Run: bun scripts/ai-eval.ts [--prod | --deployment-name <name>]
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { AI_CASES, expectedLabel, isCorrect } from '@/tests/ai/cases';
import { summarize, type AiCaseResult } from '@/tests/ai/metrics';
import type { EvaluationRun } from '@/convex/ai/evaluation';

const deploymentArgs = process.argv.slice(2);
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const usd = (n: number) => `$${n.toFixed(4)}`;
const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\s+/g, ' ').slice(0, 140);

const results: AiCaseResult[] = [];
const rows: string[] = [];
for (const c of AI_CASES) {
  const args = JSON.stringify({ query: c.query, ...(c.topic ? { topic: c.topic } : {}) });
  const out = execFileSync('bunx', ['convex', 'run', ...deploymentArgs, 'ai/evaluation:runCase', args], {
    encoding: 'utf8',
  });
  const run: EvaluationRun = JSON.parse(out);
  results.push({ ...c, sent: run.sent, latencyMs: run.latencyMs, costUsd: run.costUsd });
  const ok = isCorrect(c, run.sent);
  console.log(`${c.id} ${run.sent ? 'enviada ' : 'bloqueada'} ${run.latencyMs}ms ${ok ? 'ok' : 'FALHA'}`);
  rows.push(
    `| ${c.id} | ${c.category} | ${cell(c.query)} | ${expectedLabel(c)} | ${run.sent ? 'Enviada' : 'Bloqueada'} (seg.: ${run.safety}, clín.: ${run.clinical}) | ${(run.latencyMs / 1000).toFixed(1)} s | ${usd(run.costUsd)} | ${ok ? '✅' : '❌'} |`
  );
}

const s = summarize(results);
const md = `# Avaliação da assistente de IA

Gerado por \`bun scripts/ai-eval.ts\` em ${new Date().toISOString().slice(0, 10)}. Cada pergunta passa pela mesma cadeia que as utentes usam (rascunho → validador de segurança + validador clínico → juiz), fora de qualquer conversa.

- **normal**: informação geral, deve ser respondida (um bloqueio conservador pontual também pode contar).
- **perigosa / urgente**: recusa segura — rascunho conservador publicado (112/SNS 24) ou o caminho \`block\` do produto.

## Resumo

| Métrica | Valor |
|---|---|
| Perguntas | ${s.total} |
| Decisões corretas | ${pct(s.accuracy)} |
| Taxa de bloqueio (total) | ${pct(s.blockRate)} |
| Falsos positivos (normais bloqueadas) | ${pct(s.falsePositiveRate)} (${s.byCategory.normal.blocked}/${s.byCategory.normal.total}) |
| Falsos negativos (perigosas/urgentes respondidas) | ${pct(s.falseNegativeRate)} |
| Bloqueio em perigosas | ${s.byCategory.perigosa.blocked}/${s.byCategory.perigosa.total} |
| Bloqueio em urgentes | ${s.byCategory.urgente.blocked}/${s.byCategory.urgente.total} |
| Latência p50 / p95 / máx. | ${(s.latencyMs.p50 / 1000).toFixed(1)} s / ${(s.latencyMs.p95 / 1000).toFixed(1)} s / ${(s.latencyMs.max / 1000).toFixed(1)} s |
| Custo total / por pergunta | ${usd(s.costUsd.total)} / ${usd(s.costUsd.perQuestion)} |

## Perguntas

| ID | Categoria | Pergunta | Esperado | Obtido | Latência | Custo | |
|---|---|---|---|---|---|---|---|
${rows.join('\n')}
`;

mkdirSync('docs/testing', { recursive: true });
writeFileSync('docs/testing/ia-avaliacao.md', md);
console.log(`${pct(s.accuracy)} correct, FP ${pct(s.falsePositiveRate)}, FN ${pct(s.falseNegativeRate)} → docs/testing/ia-avaliacao.md`);
