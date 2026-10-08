// The app says "enfermeiro" for the health professional (the team is nurses).
// Rewrites "profissional" as a noun; keeps it where it is an adjective
// ("cédula profissional", "tom … profissional"). Used for the AI prompts
// (defaults and the stored versions, maintenance:useNurseWording).
const KEEP = [
  'cédula profissional',
  'Cédula profissional',
  'apoio profissional',
  'aconselhamento profissional',
  'Dados profissionais',
  'acolhedor mas profissional',
];

const RULES: [string, string][] = [
  ['Falar com um profissional', 'Falar com enfermeiro'],
  ['Falar com profissional', 'Falar com enfermeiro'],
  ['profissionais de saúde da mulher', 'enfermeiros'],
  ['Profissionais de saúde', 'Enfermeiros'],
  ['profissionais de saúde', 'enfermeiros'],
  ['Profissional de saúde', 'Enfermeiro'],
  ['profissional de saúde', 'enfermeiro'],
  ['Profissionais', 'Enfermeiros'],
  ['profissionais', 'enfermeiros'],
  ['Profissional', 'Enfermeiro'],
  ['profissional', 'enfermeiro'],
  // Medication is prescribed by a doctor, not a nurse.
  ['sem indicação de um enfermeiro', 'sem indicação médica'],
];

export function toNurseWording(text: string): string {
  let s = text;
  KEEP.forEach((k, i) => (s = s.split(k).join(`\u0000${i}\u0000`)));
  for (const [a, b] of RULES) s = s.split(a).join(b);
  KEEP.forEach((k, i) => (s = s.split(`\u0000${i}\u0000`).join(k)));
  return s;
}
