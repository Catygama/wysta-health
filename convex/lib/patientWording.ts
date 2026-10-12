// The platform is for women's sexual and reproductive health: the patient is
// "a utente". Prompts that said "o utente" made the models write summaries in
// the masculine ("O utente referiu..."). Rewrites the masculine forms around
// "utente(s)". Used for the AI prompts (defaults and the stored versions,
// maintenance:usePatientWording).
const RULES: [RegExp, string][] = [
  [/\bO utente\b/g, 'A utente'],
  [/\bo utente\b/g, 'a utente'],
  [/\bOs utentes\b/g, 'As utentes'],
  [/\bos utentes\b/g, 'as utentes'],
  [/\bdo utente\b/g, 'da utente'],
  [/\bdos utentes\b/g, 'das utentes'],
  [/\bao utente\b/g, 'à utente'],
  [/\baos utentes\b/g, 'às utentes'],
  [/\bno utente\b/g, 'na utente'],
  [/\bpelo utente\b/g, 'pela utente'],
  [/\bum utente\b/g, 'uma utente'],
  [/\bdeste utente\b/g, 'desta utente'],
  [/\beste utente\b/g, 'esta utente'],
];

export function toPatientWording(text: string): string {
  return RULES.reduce((s, [re, to]) => s.replace(re, to), text);
}
