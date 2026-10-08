import { describe, it, expect } from 'vitest';
import { pseudonymize } from './pseudonymize';

describe('pseudonymize', () => {
  const id = { names: ['Ana Maria', 'Maria', 'Ana'], email: 'ana@x.pt' };
  it('masks the name parts and the email, whole words only', () => {
    expect(pseudonymize('Olá Ana Maria (ana@x.pt). A Maria e a ANA. Banana, Mariana.', id)).toBe(
      'Olá [nome] ([email]). A [nome] e a [nome]. Banana, Mariana.',
    );
  });
  it('leaves text alone when there is nothing to mask', () => {
    expect(pseudonymize('Sem nomes aqui.', { names: [] })).toBe('Sem nomes aqui.');
  });
});
