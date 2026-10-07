import { describe, it, expect } from 'vitest';
import { TRIAGE_SEEDS } from './seedData';
import { calculateRiskLevel, type RiskAssessment } from './risk';

const seed = (topic: string) => TRIAGE_SEEDS.find((s) => s.topic === topic)!;
const risk = (topic: string, responses: Record<string, unknown>) =>
  calculateRiskLevel(responses, seed(topic).riskAssessment as RiskAssessment);

describe('triage seeds', () => {
  it("each alert's trigger fits its question type", () => {
    for (const s of TRIAGE_SEEDS) {
      for (const q of s.questions) {
        if (!q.alert) continue;
        const where = `${s.topic}/${q.id}`;
        if (q.type === 'scale') expect(q.alert.minScale, where).toBeDefined();
        else if (q.type === 'multiple-choice') {
          expect(q.alert.equals, where).toBeDefined();
          for (const v of q.alert.equals!) expect(q.options, where).toContain(v);
        } else expect(q.type, where).toBe('yes-no');
      }
    }
  });

  it('alert levels follow the agreed mapping', () => {
    const levels = Object.fromEntries(
      TRIAGE_SEEDS.flatMap((s) => s.questions.filter((q) => q.alert).map((q) => [`${s.topic}/${q.id}`, q.alert!.level])),
    );
    expect(levels).toEqual({
      'menstrual-cycle/pain-intensity': 'urgent',
      'menstrual-cycle/heavy-bleeding': 'urgent',
      'menstrual-cycle/ectopic-signs': 'emergency',
      'menstrual-cycle/fever-pain': 'urgent',
      'contraception/main-concern': 'time-sensitive',
      'contraception/unprotected': 'time-sensitive',
      'sti/lesions': 'priority',
      'sti/fever-pain': 'urgent',
      'pregnancy/bleeding': 'emergency',
      'pregnancy/abdominal-pain': 'emergency',
      'pregnancy/reduced-movement': 'urgent',
      'pregnancy/preeclampsia-signs': 'urgent',
      'pregnancy/fluid-loss': 'urgent',
      'general/alarm-signs': 'emergency',
    });
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

  it('time-sensitive and priority signs still count as high risk for professionals', () => {
    expect(risk('contraception', { 'current-method': 'Nenhum', 'main-concern': 'Eficácia do método', unprotected: 'yes' })).toBe('high');
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
