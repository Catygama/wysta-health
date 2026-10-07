import { describe, it, expect } from 'vitest';
import { TRIAGE_SEEDS } from './seedData';
import { calculateRiskLevel, type RiskAssessment } from './risk';

const seed = (topic: string) => TRIAGE_SEEDS.find((s) => s.topic === topic)!;
const risk = (topic: string, responses: Record<string, unknown>) =>
  calculateRiskLevel(responses, seed(topic).riskAssessment as RiskAssessment);

describe('triage seeds', () => {
  it('only yes/no questions are emergency signs (the alert fires on "yes")', () => {
    for (const s of TRIAGE_SEEDS) {
      for (const q of s.questions) {
        if (q.isRedFlag) expect(q.type, `${s.topic}/${q.id}`).toBe('yes-no');
      }
    }
  });

  it('conditional questions depend on an earlier question and a real option', () => {
    for (const s of TRIAGE_SEEDS) {
      s.questions.forEach((q, i) => {
        if (!q.showIf) return;
        const parentIdx = s.questions.findIndex((p) => p.id === q.showIf!.questionId);
        expect(parentIdx, `${s.topic}/${q.id}`).toBeGreaterThanOrEqual(0);
        expect(parentIdx).toBeLessThan(i);
        for (const v of q.showIf.equals) {
          expect(s.questions[parentIdx].options).toContain(v);
        }
      });
    }
  });

  it('priority signs mark the request urgent without being emergency signs', () => {
    const contraception = seed('contraception').questions.find((q) => q.id === 'unprotected')!;
    expect(contraception.isRedFlag).toBeFalsy();
    expect(risk('contraception', { 'current-method': 'Nenhum', 'main-concern': 'Eficácia do método', unprotected: 'yes' })).toBe('high');

    const lesions = seed('sti').questions.find((q) => q.id === 'lesions')!;
    expect(lesions.isRedFlag).toBeFalsy();
    expect(risk('sti', { discharge: 'no', lesions: 'yes', 'urination-pain': 'no', 'fever-pain': 'no' })).toBe('high');
  });

  it('early pregnancy without symptoms is low risk', () => {
    expect(
      risk('pregnancy', {
        weeks: 'Menos de 12 semanas',
        bleeding: 'no',
        'abdominal-pain': 'no',
        'preeclampsia-signs': 'no',
        'fluid-loss': 'no',
      }),
    ).toBe('low');
  });

  it('menstrual pain of 9 or more, or symptoms for more than 4 days, raise the risk', () => {
    const calm = { 'heavy-bleeding': 'no', 'ectopic-signs': 'no', 'fever-pain': 'no', duration: '1-3 dias' };
    expect(risk('menstrual-cycle', { ...calm, 'pain-intensity': 3 })).toBe('low');
    expect(risk('menstrual-cycle', { ...calm, 'pain-intensity': 9 })).toBe('high');
    expect(risk('menstrual-cycle', { ...calm, 'pain-intensity': 3, duration: 'Mais de 1 semana' })).toBe('medium');
  });
});
