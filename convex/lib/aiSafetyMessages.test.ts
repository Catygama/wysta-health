import { describe, it, expect } from 'vitest';
import { detectSafetyRule, SAFETY_RULES } from './aiSafetyMessages';

const id = (text: string) => detectSafetyRule(text)?.id ?? null;

describe('rule-based safety detection', () => {
  it('baby movements: each pattern and spelling variant triggers', () => {
    for (const text of [
      'Não sinto o bebé desde ontem',
      'nao sinto o bebe',
      'Estou grávida e deixei de sentir o bebé mexer desde ontem.',
      'O bebé não mexe há várias horas',
      'o meu bebé quase não se mexe hoje',
      'O bebé deixou de mexer',
      'Sinto que o bebé mexe menos do que antes',
      'Tenho notado menos movimentos do bebé',
      'Os movimentos do bebé diminuíram muito',
    ]) {
      expect(id(text), text).toBe('baby-movement');
    }
  });

  it('sexual violence: each pattern and variant triggers', () => {
    for (const text of [
      'Fui forçada a ter relações ontem à noite. Não sei o que fazer.',
      'fui forcada',
      'Ele obrigou-me a ter relações',
      'ele obrigou-me a ter relacoes',
      'Acho que fui violada',
      'Foi uma violação',
      'Abusaram de mim na festa',
      'Tivemos relações sem o meu consentimento',
      'Fui forçada a tomar a pílula e depois violaram-me',
    ]) {
      expect(id(text), text).toBe('sexual-violence');
    }
  });

  it('suicidal ideation and self-harm: each pattern and variant triggers', () => {
    for (const text of [
      'Já não aguento mais, estou a pensar acabar com a minha vida.',
      'Quero matar-me',
      'penso em suicídio',
      'tenho pensamentos suicidas',
      'Não quero viver mais',
      'não consigo continuar a viver assim',
      'Às vezes tenho vontade de me fazer mal',
      'quero morrer',
    ]) {
      expect(id(text), text).toBe('suicide');
    }
  });

  it('similar but ordinary messages do not trigger', () => {
    for (const text of [
      'O bebé mexe muito à noite, é normal?',
      'Quando é que vou sentir o bebé mexer pela primeira vez?',
      'O bebé mexe-se imenso depois das refeições',
      'Estas cólicas estão a matar-me',
      'A pílula pode fazer-me mal?',
      'Fui obrigada a mudar de pílula pelo médico',
      'Fui forçada a mudar de pílula por causa das enxaquecas',
      'Como falo de consentimento com o meu parceiro?',
      'Há violação da minha privacidade se o enfermeiro vir as conversas?',
      'Quero aproveitar mais a minha vida sexual',
      'Quantos dias dura normalmente um ciclo menstrual?',
    ]) {
      expect(id(text), text).toBeNull();
    }
  });

  it('every rule has a fixed message with a concrete contact', () => {
    const contacts: Record<string, RegExp> = {
      'baby-movement': /SNS Grávida \(808 24 24 24\).*112/,
      'sexual-violence': /112.*APAV, 116 006/,
      suicide: /112.*SNS 24 \(808 24 24 24\)/,
    };
    for (const rule of SAFETY_RULES) {
      expect(rule.message).toMatch(contacts[rule.id]);
      expect(rule.message).not.toContain('—');
    }
  });
});
