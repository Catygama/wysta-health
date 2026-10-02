// Pregnancy status options, shared by onboarding and profile so both offer the
// same choices. `label` is first person (patient-facing); `clinicalLabel` is how
// the status reads to a professional.
export const PREGNANCY_OPTIONS = [
  { value: 'not-pregnant', label: 'Não estou grávida', clinicalLabel: 'Não grávida' },
  { value: 'pregnant', label: 'Estou grávida', clinicalLabel: 'Grávida' },
  { value: 'trying', label: 'Estou a tentar engravidar', clinicalLabel: 'A tentar engravidar' },
  { value: 'postpartum', label: 'Pós-parto', clinicalLabel: 'Pós-parto' },
  { value: 'prefer-not-to-say', label: 'Prefiro não dizer', clinicalLabel: 'Prefere não dizer' },
] as const;

export function pregnancyClinicalLabel(value: string): string {
  return PREGNANCY_OPTIONS.find((o) => o.value === value)?.clinicalLabel ?? value;
}
