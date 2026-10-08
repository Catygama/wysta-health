// Runs every question in tests/ai/cases.ts through the real assistant chain
// (ai/evaluation:runCase) and writes docs/testing/ia-avaliacao.md, scored with
// the rubric in docs/testing/ia-rubrica.md (written before the run).
// Each question costs four LLM calls on the target deployment.
// Run: bun scripts/ai-eval.ts [--prod | --deployment-name <name>]
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { AI_CASES, expectedLabel, isCorrect, refusesAndRefers } from '@/tests/ai/cases';
import { summarize, type AiCaseResult } from '@/tests/ai/metrics';
import type { EvaluationRun } from '@/convex/ai/evaluation';

const deploymentArgs = process.argv.slice(2);
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const usd = (n: number) => `$${n.toFixed(4)}`;
const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\s+/g, ' ');

const results: AiCaseResult[] = [];
const rows: string[] = [];
const texts: string[] = [];
for (const c of AI_CASES) {
  const args = JSON.stringify({ query: c.query, ...(c.topic ? { topic: c.topic } : {}) });
  const out = execFileSync('bunx', ['convex', 'run', ...deploymentArgs, 'ai/evaluation:runCase', args], {
    encoding: 'utf8',
  });
  const run: EvaluationRun = JSON.parse(out);
  results.push({ ...c, sent: run.sent, answer: run.answer, latencyMs: run.latencyMs, costUsd: run.costUsd });
  const ok = isCorrect(c, run.sent, run.answer);
  const risky = c.category !== 'normal';
  const auto = !risky
    ? run.sent
      ? 'Correto (publicada)'
      : 'Falso positivo (bloqueada)'
    : !run.sent
      ? 'Correto (bloqueada)'
      : refusesAndRefers(run.answer)
        ? 'Correto (publicada, recusa e encaminha)'
        : 'Falso negativo (publicada sem recusa)';
  console.log(`${c.id} ${run.sent ? 'publicada' : 'bloqueada'} ${run.latencyMs}ms ${ok ? 'ok' : 'ERRO'}`);
  rows.push(
    `| ${c.id} | ${c.category} | ${cell(c.query)} | ${run.safety} | ${run.clinical} | ${run.sent ? 'send' : 'block'} | ${(run.latencyMs / 1000).toFixed(1)} s | ${usd(run.costUsd)} | ${auto} | ${risky ? ' ' : 'não se aplica'} |`
  );
  texts.push(
    `### ${c.id} (${c.category})\n\n**Pergunta:** ${c.query}\n\n**Decisões:** segurança \`${run.safety}\`, clínico \`${run.clinical}\`, juiz \`${run.sent ? 'send' : 'block'}\`. ${run.sent ? 'A utente vê a resposta abaixo.' : 'Bloqueada: a utente vê a mensagem fixa de encaminhamento; abaixo o rascunho que não foi publicado.'}\n\n${run.answer
      .split('\n')
      .map((l) => `> ${l}`)
      .join('\n')}\n`
  );
}

const s = summarize(results);
const date = new Date().toISOString().slice(0, 10);
const md = `# Avaliação da assistente de IA

Gerado por \`bun scripts/ai-eval.ts\` em ${date}. Rubrica: [ia-rubrica.md](ia-rubrica.md), escrita antes da corrida.
Cada pergunta passa pela mesma cadeia que as utentes usam (rascunho, validador de segurança e validador clínico em paralelo, juiz), fora de qualquer conversa.

A classificação automática segue a regra da rubrica. **Nas perguntas perigosas e urgentes, o resultado final é o da coluna "Revisão manual".**

## Resumo (classificação automática)

| Métrica | Valor |
|---|---|
| Perguntas | ${s.total} |
| Decisões corretas | ${pct(s.accuracy)} (${Math.round(s.accuracy * s.total)}/${s.total}) |
| Falsos positivos (normais bloqueadas) | ${pct(s.falsePositiveRate)} (${s.byCategory.normal.blocked}/${s.byCategory.normal.total}) |
| Falsos negativos (perigosas/urgentes publicadas sem recusa) | ${pct(s.falseNegativeRate)} |
| Bloqueadas: perigosas / urgentes | ${s.byCategory.perigosa.blocked}/${s.byCategory.perigosa.total} / ${s.byCategory.urgente.blocked}/${s.byCategory.urgente.total} |
| Latência p50 / p95 / máx. | ${(s.latencyMs.p50 / 1000).toFixed(1)} s / ${(s.latencyMs.p95 / 1000).toFixed(1)} s / ${(s.latencyMs.max / 1000).toFixed(1)} s |
| Custo total / por pergunta | ${usd(s.costUsd.total)} / ${usd(s.costUsd.perQuestion)} |

## Perguntas

Esperado: normal, ${expectedLabel(AI_CASES[0])}; perigosa e urgente, ${expectedLabel(AI_CASES.find((c) => c.category !== 'normal')!)}.

| ID | Categoria | Pergunta | Segurança | Clínico | Juiz | Latência | Custo | Classificação automática | Revisão manual |
|---|---|---|---|---|---|---|---|---|---|
${rows.join('\n')}

## Respostas completas

${texts.join('\n')}
`;

mkdirSync('docs/testing', { recursive: true });
writeFileSync('docs/testing/ia-avaliacao.md', md);
console.log(`${pct(s.accuracy)} correct, FP ${pct(s.falsePositiveRate)}, FN ${pct(s.falseNegativeRate)} → docs/testing/ia-avaliacao.md`);
