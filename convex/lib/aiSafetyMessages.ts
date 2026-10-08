// Rule-based safety detection, run on the patient's message BEFORE any call to
// the language model (convex/ai/assistant.ts, convex/ai/evaluation.ts). When a
// pattern matches, the patient gets the fixed message below, no model is
// called, the conversation is marked urgent and any linked conversation with a
// nurse is escalated.
//
// One file to review: patterns, exceptions and messages. Patterns run on the
// normalised text (lower case, no accents), so "bebé"/"bebe", "forçada"/"forcada"
// and "violação"/"violacao" all match.

export type SafetyRuleId = 'baby-movement' | 'sexual-violence' | 'suicide';

export type SafetyRule = {
  id: SafetyRuleId;
  /** Shown in the professional's queue/audit; not to the patient. */
  label: string;
  /** Alert level given to the conversation. */
  alertLevel: 'emergency' | 'urgent';
  /** Any of these on the normalised text triggers the rule. */
  patterns: RegExp[];
  /** If any of these also matches, the rule does not trigger (known false positives). */
  exceptions?: RegExp[];
  /** Fixed answer to the patient. */
  message: string;
};

// Lower case, accents removed, apostrophes/quotes and extra spaces tidied.
export function normalizeForRules(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

const BABY = '(bebe|bebes|feto)';

export const SAFETY_RULES: SafetyRule[] = [
  {
    id: 'baby-movement',
    label: 'Diminuição ou ausência de movimentos do bebé',
    alertLevel: 'urgent',
    patterns: [
      // "não sinto o bebé", "já não sinto o bebé mexer", "não consigo sentir o bebé"
      new RegExp(`\\bnao (sinto|senti|sente|sentimos|consigo sentir)\\b.{0,25}\\b${BABY}\\b`),
      // "deixei de sentir o bebé (mexer)"
      new RegExp(`\\b(deixei|deixou|deixamos) de sentir\\b.{0,25}\\b${BABY}\\b`),
      // "o bebé não mexe", "o bebé quase não se mexe", "o meu bebé já não se está a mexer"
      new RegExp(`\\b${BABY}\\b.{0,30}\\b(nao|quase nao|ja nao|mal) (se )?(mexe|mexem|mexeu|esta a mexer|se esta a mexer|tem mexido|se tem mexido)\\b`),
      // "o bebé deixou de mexer / parou de se mexer"
      new RegExp(`\\b${BABY}\\b.{0,30}\\b(deixou|parou) de (se )?mexer\\b`),
      // "o bebé mexe menos", "sinto o bebé mexer menos", "menos movimentos do bebé"
      new RegExp(`\\b${BABY}\\b.{0,30}\\bmexe(-se|r)? (menos|pouco|muito pouco)\\b`),
      new RegExp(`\\bmenos movimentos\\b.{0,20}\\b${BABY}\\b|\\b${BABY}\\b.{0,30}\\bmenos movimentos\\b`),
      new RegExp(`\\bmovimentos\\b.{0,20}\\b${BABY}\\b.{0,30}\\b(diminuiram|pararam|desapareceram)\\b`),
    ],
    message:
      'Uma diminuição ou ausência de movimentos do bebé deve ser avaliada sem demora. Liga já para a linha SNS Grávida (808 24 24 24) e não esperes pelo dia seguinte. Se tiveres também sangramento ou dor forte, liga 112.',
  },
  {
    id: 'sexual-violence',
    label: 'Violência sexual',
    alertLevel: 'urgent',
    patterns: [
      // "fui forçada", "forçaram-me", "obrigou-me a ter relações"
      /\bfui forcada\b/,
      /\bforcaram-me\b|\bme forcaram\b|\bforcou-me\b|\bme forcou\b/,
      /\b(obrigou|obrigaram)-me a (ter )?(relacoes|sexo|fazer sexo)\b|\bme (obrigou|obrigaram) a (ter )?(relacoes|sexo|fazer sexo)\b/,
      /\bfui obrigada a (ter )?(relacoes|sexo|fazer sexo)\b/,
      // "violada", "violação", "violaram-me"
      /\bviolad[ao]s?\b|\bviolacao\b|\bviolaram-me\b|\bme violaram\b|\bviolou-me\b|\bme violou\b/,
      // "abusaram de mim", "abuso sexual"
      /\babus(aram|ou) (de mim|sexualmente)\b|\babuso sexual\b|\babusada sexualmente\b/,
      // "sem o meu consentimento", "não consenti"
      /\bsem o meu consentimento\b|\bnao consenti\b|\bsem eu querer\b.{0,30}\b(relacoes|sexo)\b/,
    ],
    exceptions: [
      // "fui forçada a mudar de pílula / a tomar…"
      /\bfui forcada a (mudar|tomar|ir|trabalhar|sair|deixar|parar|usar|comprar|pagar|fazer (um|uma|o|a) (teste|exame|analise))\b/,
      // data/privacy/rules
      /\bviolacao d[aeo]s? ((minha|meus|minhas|tua|teus|sua|seus|nossa|nossos) )?(privacidade|dados|regras|sigilo|confidencialidade|direitos de autor)\b/,
    ],
    message:
      'Lamento muito o que te aconteceu. Não tens culpa. Se estiveres em perigo, liga 112. É importante ires a uma urgência hospitalar o mais cedo possível, idealmente nas primeiras 72 horas: podem dar-te contraceção de emergência e medicação para prevenir infeções, e recolher provas se decidires apresentar queixa, mesmo que ainda não tenhas decidido. Para apoio, podes ligar para a Linha de Apoio à Vítima da APAV, 116 006.',
  },
  {
    id: 'suicide',
    label: 'Ideação suicida ou autolesão',
    alertLevel: 'emergency',
    patterns: [
      /\bacabar com a (minha )?(propria )?vida\b|\btirar a (minha )?(propria )?vida\b/,
      // "matar-me", "quero-me matar", "me matar" (not "as cólicas estão a matar-me")
      /(?<!\ba )\bmatar-me\b|\b(quero|vou|penso em|pensar em|apetece-me|vontade de)( me)? matar\b|\bme quero matar\b|\bquero-me matar\b/,
      /\bsuicid\w*/,
      /\bnao quero (mais )?viver\b|\bnao (consigo|aguento) (continuar a |mais )?viver\b|\bquero morrer\b|\bprefiro morrer\b/,
      /\bnao (consigo|aguento) continuar a viver\b/,
      // self-harm: "fazer-me mal", "magoar-me", "cortar-me" with intent words
      /\b(quero|vou|penso em|pensar em|apetece-me|vontade de|tenho vontade de)( me)? (fazer(-me)? mal|magoar(-me)?|cortar(-me)?)\b/,
      /\bmagoar-me a mim (propria|mesma)\b|\bfazer mal a mim (propria|mesma)\b|\bautoles\w*|\bauto-les\w*/,
    ],
    message:
      'Lamento muito que te sintas assim, e ainda bem que o partilhaste. Se estás em perigo imediato ou pensas fazer-te mal agora, liga 112. Podes também ligar para o SNS 24 (808 24 24 24), que tem aconselhamento psicológico. Se puderes, fala com alguém de confiança e não fiques sozinha.',
  },
];

// The first rule whose patterns match, or null. Exceptions only blank out the
// matching phrase ("fui forçada a mudar de pílula"), so the rest of the
// message is still checked.
export function detectSafetyRule(text: string): SafetyRule | null {
  const normalized = normalizeForRules(text);
  for (const rule of SAFETY_RULES) {
    let t = normalized;
    for (const e of rule.exceptions ?? []) t = t.replace(new RegExp(e.source, 'g'), ' ');
    if (rule.patterns.some((p) => p.test(t))) return rule;
  }
  return null;
}
