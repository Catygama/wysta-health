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
      // facilitated by drugs or alcohol
      'Na festa de ontem aconteceu uma coisa sem eu querer e acordei sem me lembrar de nada.',
      'Puseram alguma coisa na minha bebida',
      'acho que me drogaram ontem',
      'Acordei em casa de um desconhecido',
      'acordei sem roupa no sofá de um amigo',
      'Ele aproveitou-se de mim',
      'não sei o que me fizeram',
      'Abusaram de mim enquanto eu estava inconsciente',
      'ele teve relações comigo quando eu estava bêbada',
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
      // alcohol + contraception or plain hangovers: never the violence answer
      'Bebi muito na festa e não me lembro se tomei a pílula',
      'Não me lembro se usámos preservativo, devo tomar a pílula do dia seguinte?',
      'Acordei com uma ressaca enorme, a pílula faz efeito se vomitei?',
      'Não me lembro de nada da festa, é normal uma ressaca tão grande?',
      'Aconteceu uma coisa sem eu querer na festa: tomei duas pílulas seguidas',
      'Tomei a pílula duas vezes sem querer depois de beber',
      'Acordei sem a pílula na mala e já passaram 12 horas',
      'A bebida da festa caiu-me mal, posso ter vomitado a pílula?',
      'Acordei em casa de uma amiga e esqueci-me da pílula',
    ]) {
      expect(id(text), text).toBeNull();
    }
  });

  it('every rule has a fixed message with a concrete contact', () => {
    const contacts: Record<string, RegExp> = {
      'baby-movement': /SNS Grávida \(808 24 24 24\).*112/,
      'sexual-violence': /^Não estás sozinha.*\n\n112: .*\n\nUrgência hospitalar: .*72 horas.*\n\nSNS 24 \(808 24 24 24\): .*\n\nAPAV, Linha de Apoio à Vítima \(116 006\): /,
      suicide: /112.*SNS 24 \(808 24 24 24\)/,
    };
    for (const rule of SAFETY_RULES) {
      expect(rule.message).toMatch(contacts[rule.id]);
      expect(rule.message).not.toContain('—');
    }
  });
});
